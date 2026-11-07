import './style.css';
import { Container, Graphics, Rectangle } from 'pixi.js';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { startAutosave } from './core/autosave';
import { FixedStepper } from './core/loop';
import { GameStore } from './core/store';
import { BALANCE } from './data/balance';
import { BREEDS, coatOf, type BreedLook } from './data/breeds';
import { DECOR_NAMES, FAMILY, KENNEL, LEVELS, NAME_ERRORS, NEED_WORDS, TRAINING, UI, UNLOCKS, CHORES } from './data/strings';
import { GestureRecognizer, type PuppyProbe } from './input/gestures';
import { bindPointer, type PointerIntercept } from './input/pointer';
import { ToyHand } from './input/toyHand';
import { BowlsView } from './render/bowls';
import { PuppyView } from './render/puppy/PuppyView';
import { Room } from './render/room';
import { createStage, type Stage } from './render/stage';
import { ToysView } from './render/toys';
import { PoopsView } from './render/poops';
import { openSaveStore } from './save/storage';
import { adoptionPrice, validateName, type Candidate } from './sim/adoption';
import { createMind, performTrick, type CareTool, type Mood, type PuppyMind } from './sim/behavior';
import { TRICKS, type TrickId } from './data/tricks';
import { createGameState, createNewGame, homeId, unnamedDogs, type GameState } from './sim/game';
import { NEED_KINDS, localHour, needLevel } from './sim/needs';
import type { CoatParams, ContestId, DecorId, DogId, TemperamentId } from './sim/state';
import { mountDebug, rewind, type DebugProbe } from './ui/debug';
import { mountHud } from './ui/hud';
import { ICONS } from './ui/icons';
import { mountKennel, nameDialog } from './ui/kennel';
import type { TrainingHandlers } from './ui/training';
import { VoiceController } from './ui/voice';
import { ITEM_BY_ID } from './data/items';
import { marketStock, shopCatalog } from './sim/economy';
import { currentQuestions } from './sim/game';
import { extendRoute, maxMeters, routeMeters, stepBonus, walkGains } from './sim/walk';
import { WalkScene } from './render/walkScene';
import { BathScene } from './render/bathScene';
import { DirtView } from './render/dirt';
import { mountChoresHud } from './ui/chores';
import { mountBathHud, STAGE_TOOL } from './ui/bath';
import { openBook, openMarket, openOutings, type OutingHandlers } from './ui/outings';
import { openMap } from './ui/walkMap';
import { mountWalkHud } from './ui/walkHud';
import { OUT } from './data/strings';
import { availableBreeds, availableDecors, itemLocked, ropeUnlocked, tierContent } from './sim/unlocks';
import { canEnter, prizeLeft } from './sim/contests';
import { dogObedience } from './sim/obedience';
import { levelOf } from './sim/levels';
import { seasonAt, type Season } from './sim/season';
import { canLearnNew, repsNeeded } from './sim/tricks';
import { listenSteps } from './input/pedometer';
import { openWorkshop } from './ui/workshop';
import { ContestScene } from './render/contestScene';
import { mountContestHud, openContests } from './ui/contests';
import { openFamily } from './ui/family';
import { openSettings } from './ui/settings';
import { exportFileName, exportSave, importSave } from './save/transfer';
import { SETTINGS } from './data/strings';

const tz = (now: number): number => new Date(now).getTimezoneOffset();
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
/** D-77 : `?debug&season=winter` impose une saison (tests, captures). */
const FORCED_SEASON = ((): Season | null => {
  const v = DEBUG ? params.get('season') : null;
  return v === 'spring' || v === 'summer' || v === 'autumn' || v === 'winter' ? v : null;
})();
const seasonNow = (now: number): Season => FORCED_SEASON ?? seasonAt(now, new Date(now).getTimezoneOffset());

/** Humeur affichée au chenil : le tempérament se voit avant l'adoption. */
const KENNEL_MOOD: Record<TemperamentId, Mood> = { sage: 'content', joueur: 'happy', timide: 'startled', tetu: 'calm' };

/** Ce que fait la scène à chaque image, selon l'écran en cours. */
/** Doigts de la patte dessinée sur les repères des chiots hors de la vue (D-89). */
const PAW_TOES = [
  [-7, -4],
  [-2.5, -9],
  [2.5, -9],
  [7, -4],
] as const;

interface Mode {
  frame(dtMs: number, t: number): void;
  intercept: PointerIntercept;
}

function staticMind(pos: { x: number; z: number }, mood: Mood, facing = 0): PuppyMind {
  const m = createMind(1, pos);
  return { ...m, posture: 'sit', mood, facing, excitement: mood === 'happy' ? 0.9 : 0.4 };
}

const breedOf = (id: string | undefined): BreedLook => BREEDS[id ?? 'beagle'] ?? (BREEDS.beagle as BreedLook);

/** Portraits des races pour les cartes du chenil, dessinés une fois par race. */
const pictures: Record<string, string> = {};
async function portraits(stage: Stage, ids: readonly string[]): Promise<Record<string, string>> {
  const room = new Room();
  room.layout(400, 460);
  for (const id of ids) {
    const breed = BREEDS[id];
    if (!breed || pictures[id]) continue;
    const view = new PuppyView(breed, { base: 0, patch: 0, patchAmount: 1 }, room, { x: 0, z: 0.75 });
    const mind = { ...staticMind({ x: 0, z: 0.75 }, 'happy', 0.55), posture: 'stand' as const };
    for (let i = 0; i < 40; i++) view.update(50, mind, null);
    // Cadre autour du chiot : un Graphics vide placé à l'origine fausserait les bornes.
    const f = room.floorToScreen({ x: 0, z: 0.75 });
    const k = f.s * breed.size;
    const frame = new Rectangle(f.x - k * 0.85, f.y - k * 1.25, k * 1.7, k * 1.4);
    pictures[id] = await stage.app.renderer.extract.base64({ target: view.container, frame });
    view.container.destroy({ children: true });
  }
  return pictures;
}

async function boot(): Promise<void> {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app introuvable');

  const saves = await openSaveStore();
  const now = Date.now();
  const loaded = await saves.load();
  const fresh = createNewGame(now, (Math.random() * 2 ** 32) >>> 0);
  // Nouvelle partie : on suit la préférence « réduire les animations » de l'appareil.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) fresh.settings.reduceMotion = true;
  const store = new GameStore(createGameState(loaded ?? fresh));
  store.dispatch({ type: 'session/start', now, tzOffsetMin: tz(now) });
  const autosave = startAutosave(store, saves);
  await autosave.saveNow();

  const stage = await createStage(host);
  const sfx = new Sfx(store.getState().save.settings.sfxVolume);
  const music = new Music(store.getState().save.settings.musicVolume);
  const applySettings = (): void => {
    const st = store.getState().save.settings;
    sfx.setVolume(st.sfxVolume);
    music.setVolume(st.musicVolume);
    PuppyView.reduceMotion = st.reduceMotion;
    document.body.classList.toggle('reduce-motion', st.reduceMotion);
  };
  applySettings();
  let mode: Mode | null = null;
  let lastInputAt = 0;
  const latencies: number[] = [];

  // Les gestes passent toujours par le mode en cours.
  const recognizerRef: { current: GestureRecognizer | null } = { current: null };
  const router: PointerIntercept = {
    down: (x, y, t) => (mode ? mode.intercept.down(x, y, t) : true),
    move: (x, y, t) => mode?.intercept.move(x, y, t),
    up: (x, y, t) => mode?.intercept.up(x, y, t),
    cancel: () => mode?.intercept.cancel(),
    steal: (x, y, t) => mode?.intercept.steal?.(x, y, t) ?? false,
  };
  bindPointer(
    stage.app.canvas,
    () => recognizerRef.current,
    (t) => {
      lastInputAt = t;
      sfx.unlock();
      music.unlock();
    },
    router,
  );

  const stepper = new FixedStepper(BALANCE.time.simStepMs, BALANCE.time.maxCatchUpSteps, (dtMs) => {
    const t = Date.now();
    store.dispatch({ type: 'tick', now: t, dtMs, tzOffsetMin: tz(t) });
  });
  stage.app.ticker.add((ticker) => {
    stepper.advance(ticker.deltaMS);
    const s = store.getState();
    stage.setHour(localHour(s.save.lastSeenAt, tz(s.save.lastSeenAt)), s.save.settings.brightness);
    stage.setDecor(s.save.settings.decor, (s.save.inventory.canape ?? 0) > 0);
    stage.setSeason(seasonNow(s.save.lastSeenAt));
    mode?.frame(ticker.deltaMS, performance.now());
  });

  // ------------------------------------------------------------ salon (F-VIE-4 : jusqu'à 3 chiots)
  function living(): void {
    const aid = (): DogId => homeId(store.getState()) ?? '';
    const dogOf = () => store.getState().save.dogs.find((d) => d.id === aid());
    const layer = new Container();
    layer.sortableChildren = true;
    stage.world.addChild(layer);
    const ring = new Graphics();
    ring.zIndex = -1;
    layer.addChild(ring);
    const views = new Map<DogId, PuppyView>();
    const heard = new Map<DogId, number>();
    /**
     * D-83 : la caméra suit un jouet lancé hors de la vue, puis le chiot qui va le chercher,
     * et revient quand tout le monde est rentré.
     * D-89 : le joueur fait glisser la vue d'un doigt (sur le sol ou le mur, pas sur un chiot) ;
     * la caméra revient alors à la vue qu'il a choisie, pas au milieu.
     */
    let cam = 0;
    let viewCam = 0;
    let lastViewX = 0;
    let press: { x: number; y: number; free: boolean } | null = null;
    let panning: { x0: number; cam0: number } | null = null;
    /** Pixels de caméra par unité de sol, à mi-profondeur. */
    const pxPerUnit = (): number => {
      const r = stage.room;
      return Math.max(1, r.floorToScreen({ x: 1, z: 0.6 }).x - r.floorToScreen({ x: 0, z: 0.6 }).x);
    };
    const clampView = (c: number): number => {
      const lim = BALANCE.puppy.roam.maxView * pxPerUnit();
      return Math.min(lim, Math.max(-lim, c));
    };
    /** Caméra qui met ce point du sol au milieu de l'écran. */
    const camFor = (p: { x: number; z: number }): number => stage.room.w / 2 - (stage.room.floorToScreen(p).x - stage.room.camX);
    const followCamera = (dtMs: number, s: GameState): void => {
      const C = BALANCE.display.camera;
      const r = stage.room;
      const points: { x: number; z: number }[] = [];
      // Un jouet compte en vol, ou au sol tant qu'un chiot va le chercher (sinon la caméra rentre),
      // avec le chiot qui court après.
      const chasers = s.save.homeDogIds.filter((id) => s.minds[id]?.toyPlan);
      const chased = new Set(chasers.map((id) => s.minds[id]?.toyPlan?.toyId));
      let following = false;
      for (const toy of s.toys) {
        if (toy.state === 'flying' || (toy.state === 'ground' && chased.has(toy.id))) {
          points.push(toy.pos);
          following = true;
        }
      }
      if (following) for (const id of chasers) points.push(s.minds[id]?.pos ?? { x: 0, z: 0.5 });
      // Le plus loin hors de la vue choisie décide ; on le garde à l'écran avec une marge.
      let want = viewCam;
      const margin = r.w * C.margin;
      for (const p of points) {
        const x = r.floorToScreen(p).x - r.camX;
        const need = x + viewCam > r.w - margin ? r.w - margin - x : x + viewCam < margin ? margin - x : viewCam;
        if (Math.abs(need - viewCam) > Math.abs(want - viewCam)) want = need;
      }
      if (panning) cam = viewCam;
      else {
        const k = 1 - Math.exp((-C.follow * dtMs) / 1000);
        cam += (want - cam) * k;
        if (Math.abs(cam - want) < 0.5) cam = want;
      }
      stage.setCamera(Math.round(cam));
      // La simulation sait où regarde le joueur : le chiot appelé vient là (D-89).
      const vx = -viewCam / pxPerUnit();
      if (Math.abs(vx - lastViewX) > 0.05 || (vx === 0 && lastViewX !== 0)) {
        lastViewX = vx;
        store.dispatch({ type: 'view/pan', x: vx });
      }
    };
    /** D-89 : repères au bord de l'écran pour les chiots hors de la vue ; les toucher y emmène. */
    const edges = new Graphics();
    edges.zIndex = 1000;
    layer.addChild(edges);
    let edgeMarks: { id: DogId; x: number; y: number }[] = [];
    const drawEdges = (s: GameState): void => {
      const r = stage.room;
      edges.clear();
      edgeMarks = [];
      for (const id of s.save.homeDogIds) {
        const m = s.minds[id];
        if (!m) continue;
        const p = r.floorToScreen(m.pos);
        // Repère seulement quand il est presque tout entier hors de l'écran.
        const out = p.s * 0.12;
        if (p.x > -out && p.x < r.w + out) continue;
        const left = p.x <= -out;
        const x = left ? 30 : r.w - 30;
        const y = Math.min(r.h - 170, Math.max(r.horizon + 30, p.y - p.s * 0.3));
        const d = left ? -1 : 1;
        const ink = id === aid() ? 0xb5562a : 0x6b5444;
        edges.circle(x, y, 22).fill({ color: 0xfdf6ea, alpha: 0.95 }).stroke({ width: 3, color: ink });
        edges.moveTo(x + d * 30, y).lineTo(x + d * 20, y - 9).lineTo(x + d * 20, y + 9).closePath().fill(ink);
        // Une patte, comme l'icône du jeu.
        edges.ellipse(x, y + 4, 7, 5.5).fill(ink);
        for (const [ox, oy] of PAW_TOES) edges.circle(x + ox, y + oy, 2.6).fill(ink);
        edgeMarks.push({ id, x, y });
      }
    };
    const edgeAt = (x: number, y: number): DogId | null => edgeMarks.find((e) => Math.hypot(e.x - x, e.y - y) < 30)?.id ?? null;

    /** Une vue par chiot de la maison ; celles des chiots partis à la pension disparaissent. */
    const sync = (): void => {
      const s = store.getState();
      for (const [id, v] of views) {
        if (!s.save.homeDogIds.includes(id)) {
          v.container.destroy({ children: true });
          views.delete(id);
        }
      }
      for (const id of s.save.homeDogIds) {
        const d = s.save.dogs.find((x) => x.id === id);
        const m = s.minds[id];
        if (views.has(id) || !d || !m) continue;
        const v = new PuppyView(breedOf(d.breedId), d.coat, stage.room, m.pos);
        v.onReaction = () => {
          if (lastInputAt > 0) latencies.push(performance.now() - lastInputAt);
          if (latencies.length > 50) latencies.shift();
        };
        layer.addChild(v.container);
        views.set(id, v);
        heard.set(id, m.events.at(-1)?.seq ?? 0);
      }
    };
    sync();
    const av = (): PuppyView | undefined => views.get(aid());
    /** Les gestes visent le chiot actif (D-61). */
    /** D-88 : dans la salle de bain, la sonde (pour le débogage et les tests) vise le chiot de la salle de bain. */
    let bathProbe: PuppyProbe | null = null;
    const pv = (): PuppyProbe | undefined => bathProbe ?? av()?.probe;
    const probe: PuppyProbe = {
      hitTest: (x, y) => pv()?.hitTest(x, y) ?? null,
      nose: () => pv()?.nose() ?? { x: 0, y: 0 },
      headTop: () => pv()?.headTop() ?? { x: 0, y: 0 },
      headRadius: () => pv()?.headRadius() ?? 1,
      toFloor: (x, y) => stage.room.screenToFloor(x, y),
      bodyCenter: () => pv()?.bodyCenter() ?? { x: 0, y: 0 },
    };
    /** Le chiot sous le doigt, le plus en avant. */
    const dogAt = (x: number, y: number): DogId | null => {
      let best: { id: DogId; z: number } | null = null;
      for (const [id, v] of views) if (v.probe.hitTest(x, y) !== null && (!best || v.container.zIndex > best.z)) best = { id, z: v.container.zIndex };
      return best?.id ?? null;
    };

    const bowls = new BowlsView(layer, stage.room);
    const toysView = new ToysView(layer, stage.room);
    const poopsView = new PoopsView(layer, stage.room);
    const dirtView = new DirtView(layer, stage.room);
    let tool: CareTool | null = null;

    /**
     * D-90 : panier de rangement, en bas à gauche, montré quand on tient un jouet
     * (et un instant quand on range tout depuis le Sac).
     */
    const basket = document.createElement('div');
    basket.className = 'toy-basket';
    basket.dataset.testid = 'toy-basket';
    basket.setAttribute('aria-hidden', 'true');
    basket.innerHTML = `${ICONS.basket}<span>${UI.basket}</span>`;
    basket.hidden = true;
    document.body.append(basket);
    let basketUntil = 0;
    let gotUntil = 0;
    const overBasket = (x: number, y: number): boolean => {
      if (basket.hidden) return false;
      const r = basket.getBoundingClientRect();
      const c = stage.app.canvas.getBoundingClientRect();
      const px = x + c.left;
      const py = y + c.top;
      return px >= r.left - 18 && px <= r.right + 18 && py >= r.top - 18 && py <= r.bottom + 18;
    };
    const basketGot = (t: number): void => {
      gotUntil = t + 500;
      basketUntil = t + 700;
    };
    const showBasket = (t: number): void => {
      const holding = hand.hand !== null && store.getState().toys.some((x) => x.state === 'held');
      basket.hidden = !holding && t > basketUntil;
      basket.classList.toggle('over', holding && hand.hand !== null && overBasket(hand.hand.x, hand.hand.y));
      basket.classList.toggle('got', t < gotUntil);
    };

    const recognizer = new GestureRecognizer(probe, (gesture) => {
      // Main présentée ou levée : le geste est reconnu après un maintien, la latence part de là.
      if (['present', 'presentEnd', 'raise', 'raiseEnd'].includes(gesture.kind)) lastInputAt = performance.now();
      if (tool) {
        // Outil en main : glisser sur le chiot savonne, rince, sèche ou brosse.
        if (gesture.kind === 'stroke' || gesture.kind === 'push') {
          const distancePx = gesture.kind === 'stroke' ? gesture.distancePx : BALANCE.gestures.pushMinPx;
          store.dispatch({ type: 'gesture', gesture: { kind: 'scrub', tool, distancePx } });
          sfx.tool(tool);
        }
        return;
      }
      store.dispatch({ type: 'gesture', gesture });
    });
    recognizerRef.current = recognizer;

    const hand = new ToyHand({
      dispatch: (a) => store.dispatch(a),
      toFloor: (x, y) => stage.room.screenToFloor(x, y),
      velocity: (vx, vy, y) => stage.room.fingerToFloorVelocity(vx, vy, y),
      toyAt: (x, y) => toysView.hitTest(x, y),
      heldToy: () => {
        const t = store.getState().toys.find((x) => x.state === 'held' || x.state === 'tug');
        return t ? { id: t.id, kind: t.kind } : null;
      },
      mouth: () => av()?.mouthScreen() ?? { x: 0, y: 0 },
      // D-71 : un jouet lâché sur la barre du bas est rangé.
      // D-90 : un jouet lâché dans le panier est rangé.
      putAwayAt: (x, y) => {
        const over = overBasket(x, y);
        if (over) basketGot(performance.now());
        return over;
      },
    });

    let toast: (text: string) => void = () => undefined;
    const voice = new VoiceController(store, aid, (t) => toast(t), () => void autosave.saveNow());
    const training: TrainingHandlers = {
      tricks() {
        const d = dogOf();
        const needed = d ? repsNeeded(d.traits, d.affection) : BALANCE.training.repsMax;
        const rows = (d?.tricks ?? []).map((t) => ({
          trickId: t.trickId,
          label: t.command.label,
          learned: t.learned,
          reps: t.repetitions,
          needed,
          voices: t.command.voice?.length ?? 0,
          mastery: t.mastery,
        }));
        return { rows, learned: rows.filter((r) => r.learned).length, max: BALANCE.training.maxTricks };
      },
      order: (trickId) => store.dispatch({ type: 'order', trickId }),
      call: () => store.dispatch({ type: 'call' }),
      forget(trickId) {
        store.dispatch({ type: 'trick/forget', trickId });
        void autosave.saveNow();
      },
      relabel(trickId, label) {
        store.dispatch({ type: 'trick/relabel', trickId, label });
        void autosave.saveNow();
      },
      voice: {
        supported: () => voice.supported(),
        record: (target) => void voice.record(target, () => undefined),
        clearAll: () => voice.clearAll(),
        nameVoices: () => voice.nameVoices(),
      },
    };

    const save = () => void autosave.saveNow();
    const outings: OutingHandlers = {
      openBath: () => {
        sfx.unlock();
        startBath();
      },
      coins: () => store.getState().save.coins,
      shop: () =>
        shopCatalog()
          .filter((i) => !itemLocked(i.id, store.getState().save.masterPoints))
          .map((i) => ({ id: i.id, price: i.price ?? 0 })),
      market: () => marketStock(store.getState().save.day.dayKey).map((o) => ({ id: o.itemId, price: o.price })),
      inventory: () => store.getState().save.inventory,
      discovered: () => store.getState().save.discovered.items,
      learnedTricks: () => (dogOf()?.tricks ?? []).filter((t) => t.learned).map((t) => t.trickId),
      buy(id, where) {
        const before = store.getState().save.coins;
        store.dispatch({ type: where === 'shop' ? 'shop/buy' : 'market/buy', itemId: id });
        save();
        return store.getState().save.coins === before ? OUT.notEnough : null;
      },
      sell(id) {
        store.dispatch({ type: 'market/sell', itemId: id });
        save();
      },
      openMap: () => showMap(),
      openContests: () => showContests(),
      openKennel: () => showKennel(),
      openFamily: () => showFamily(),
    };

    const showSettings = (): void =>
      openSettings(
        {
          get: () => store.getState().save.settings,
          set(patch) {
            store.dispatch({ type: 'settings/set', patch });
            applySettings();
            save();
          },
          clearVoices: () => voice.clearAll(),
          exportSave() {
            const t = Date.now();
            const blob = new Blob([exportSave(store.getState().save, t)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = exportFileName(t);
            a.click();
            window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          },
          async importSave(text) {
            let game;
            try {
              game = importSave(text);
            } catch {
              return SETTINGS.importBad;
            }
            autosave.stop();
            await saves.save(game);
            location.reload();
            return null;
          },
        },
        () => undefined,
      );

    const showMap = (): void => {
      const last = dogOf()?.walks.lastRewardedAt ?? null;
      openMap(
        {
          stamina: () => dogOf()?.stamina ?? 5,
          maxMeters: () => maxMeters(dogOf()?.stamina ?? 5),
          questions: () => currentQuestions(store.getState().save),
          waitMinutes: () => (last === null ? 0 : Math.max(0, Math.ceil((BALANCE.walk.cooldownMs - (Date.now() - last)) / 60_000))),
          extend: (r, node) => extendRoute(r, node, dogOf()?.stamina ?? 5),
          meters: (r) => routeMeters(r),
          start: (r) => startWalking(r),
        },
        () => undefined,
      );
    };

    /**
     * D-88 : salle de bain. Le chiot actif y est seul et debout ; les autres restent au salon.
     * Les gestes vont à la sonde du chiot de la salle de bain.
     */
    const startBath = (): void => {
      const d0 = dogOf();
      if (!d0) return;
      const id = aid();
      store.dispatch({ type: 'gesture', gesture: { kind: 'groomStart' } });
      const salon = mode;
      const scene = new BathScene(breedOf(d0.breedId), d0.coat);
      scene.layout(stage.app.screen.width, stage.app.screen.height);
      stage.app.stage.addChild(scene.container);
      stage.world.visible = false;
      document.body.dataset.mode = 'bath';
      let bathTool: CareTool | null = null;
      let pointer: { x: number; y: number } | null = null;
      const rec = new GestureRecognizer(scene.probe, (gesture) => {
        if (bathTool && (gesture.kind === 'stroke' || gesture.kind === 'push')) {
          const stageNow = store.getState().minds[id]?.bath.stage ?? 'done';
          if (stageNow !== 'done' && STAGE_TOOL[stageNow] !== bathTool) hud.wrongTool(stageNow);
          const distancePx = gesture.kind === 'stroke' ? gesture.distancePx : BALANCE.gestures.pushMinPx;
          store.dispatch({ type: 'gesture', gesture: { kind: 'scrub', tool: bathTool, distancePx } });
          sfx.tool(bathTool);
          if (pointer) scene.splash(bathTool, pointer.x, pointer.y);
          return;
        }
        // Sans outil (bain fini), on peut le caresser.
        if (!bathTool && (gesture.kind === 'stroke' || gesture.kind === 'touch')) store.dispatch({ type: 'gesture', gesture });
      });
      recognizerRef.current = rec;
      bathProbe = scene.probe;
      let seen = store.getState().minds[id]?.events.at(-1)?.seq ?? 0;
      const back = (): void => {
        store.dispatch({ type: 'gesture', gesture: { kind: 'groomEnd' } });
        hud.destroy();
        scene.container.destroy({ children: true });
        stage.world.visible = true;
        recognizerRef.current = recognizer;
        bathProbe = null;
        mode = salon;
        document.body.dataset.mode = 'living';
        save();
      };
      const hud = mountBathHud({ setTool: (t) => (bathTool = t), close: back });
      hud.update(store.getState().minds[id]?.bath.stage ?? 'wet');
      mode = {
        intercept: {
          down: (x, y) => {
            pointer = { x, y };
            return false;
          },
          move: (x, y) => {
            pointer = { x, y };
          },
          up: () => {
            pointer = null;
          },
          cancel: () => {
            pointer = null;
          },
        },
        frame(dtMs, t) {
          rec.update(t);
          const s = store.getState();
          const m = s.minds[id];
          const d = s.save.dogs.find((x) => x.id === id);
          if (!m || !d) return;
          scene.layout(stage.app.screen.width, stage.app.screen.height);
          scene.update(dtMs, m, d.needs.cleanliness, d.equipped, rec.pointerAt(t));
          // Une étape finie : son mot (la cloche est jouée avec les autres sons du chiot).
          for (const e of m.events) {
            if (e.seq <= seen) continue;
            seen = e.seq;
            if (e.type !== 'bathStep') continue;
            const order = ['wet', 'soap', 'rinse', 'dry'] as const;
            const i = m.bath.stage === 'done' ? 3 : order.indexOf(m.bath.stage as (typeof order)[number]) - 1;
            const finished = order[i];
            if (finished) hud.flash(finished);
          }
          hud.update(m.bath.stage);
        },
      };
    };

    /**
     * D-91 : ménage. Le salon reste vivant ; un glissé sur une tache la frotte à l'éponge,
     * un glissé à côté fait glisser la vue. Tout propre (ou « Terminer ») : bilan.
     */
    const startChores = (): void => {
      if (store.getState().save.dirt.length === 0) {
        toast(CHORES.clean);
        return;
      }
      store.dispatch({ type: 'chores/start' });
      const salon = mode;
      if (!salon) return;
      document.body.dataset.mode = 'chores';
      let last: { x: number; y: number } | null = null;
      let ending = false;
      const finish = (): void => {
        if (ending) return;
        ending = true;
        store.dispatch({ type: 'chores/end' });
        const r = store.getState().choresResult;
        hud.destroy();
        panning = null;
        mode = salon;
        document.body.dataset.mode = 'living';
        if (r && r.cleaned > 0) {
          toast((r.bonus ? CHORES.doneBonus : CHORES.done).replace('{n}', String(r.cleaned)).replace('{p}', String(r.points)));
          sfx.play('learned');
        } else toast(CHORES.none);
        save();
      };
      const hud = mountChoresHud({ end: finish });
      mode = {
        intercept: {
          down: (x, y) => {
            last = { x, y };
            panning = dirtView.hitTest(x, y) ? null : { x0: x, cam0: viewCam };
            return true;
          },
          move: (x, y) => {
            if (panning) {
              viewCam = clampView(panning.cam0 + (x - panning.x0));
              return;
            }
            const prev = last;
            last = { x, y };
            if (!prev) return;
            const id = dirtView.hitTest(x, y);
            if (!id) return;
            store.dispatch({ type: 'chores/scrub', dirtId: id, px: Math.hypot(x - prev.x, y - prev.y) });
            sfx.tool('soap');
          },
          up: () => {
            last = null;
            panning = null;
          },
          cancel: () => {
            last = null;
            panning = null;
          },
        },
        frame(dtMs, t) {
          salon.frame(dtMs, t);
          const s = store.getState();
          const run = s.chores;
          if (!run || s.save.dirt.length === 0) {
            finish();
            return;
          }
          const w = stage.room.w;
          let offL = 0;
          let offR = 0;
          for (const d of dirtView.targets()) {
            if (d.x < 0) offL++;
            else if (d.x > w) offR++;
          }
          hud.update(s.save.dirt.length, run.start, run.t, offL, offR);
        },
      };
    };

    /** Promenade : la scène de profil remplace le salon le temps de la marche. */
    const startWalking = (route: string[]): void => {
      store.dispatch({ type: 'walk/start', route, now: Date.now() });
      const w0 = store.getState().walk;
      const d0 = dogOf();
      if (!w0 || !d0) return;
      const salon = mode;
      const scene = new WalkScene(breedOf(d0.breedId), d0.coat, () => dogOf()?.equipped ?? []);
      scene.season = seasonNow(Date.now());
      scene.layout(stage.app.screen.width, stage.app.screen.height);
      stage.app.stage.addChild(scene.container);
      stage.setCamera(0);
      stage.world.visible = false;
      document.body.dataset.mode = 'walk';
      music.setScene('outdoor');
      let leashHand: { x: number; y: number } | null = null;
      let barks = 0;
      let walking = true;
      let pedometer: { stop(): void } | null = null;
      void listenSteps(() => store.dispatch({ type: 'walk/steps', count: 1 })).then((l) => {
        pedometer = l;
        if (!walking) l?.stop();
      });
      const back = (): void => {
        walking = false;
        pedometer?.stop();
        hud.destroy();
        scene.container.destroy({ children: true });
        stage.world.visible = true;
        store.dispatch({ type: 'walk/close' });
        save();
        mode = salon;
        document.body.dataset.mode = 'living';
        music.setScene('home');
      };
      const hud = mountWalkHud({
        finish: () => store.dispatch({ type: 'walk/finish' }),
        pickup: () => store.dispatch({ type: 'walk/pickup' }),
        enter: () => {
          const w = store.getState().walk;
          const place = w?.pause ? w.plan.events[w.pause.index]?.place : undefined;
          store.dispatch({ type: 'walk/enter' });
          if (place === 'market') openMarket(outings, () => store.dispatch({ type: 'walk/continue' }));
        },
        continue: () => store.dispatch({ type: 'walk/continue' }),
        close: back,
        gains: (w) => (w.rewarded ? { points: walkGains(w.plan.lengthM).points + w.pointsDelta + stepBonus(w.steps).points, stamina: BALANCE.walk.stamina, stepPoints: stepBonus(w.steps).points } : null),
      });
      mode = {
        intercept: {
          down(x, y) {
            leashHand = { x, y };
            store.dispatch({ type: 'walk/leash', lane: scene.laneAt(y) });
            return true;
          },
          move(x, y) {
            if (!leashHand) return;
            leashHand = { x, y };
            store.dispatch({ type: 'walk/leash', lane: scene.laneAt(y) });
          },
          up() {
            leashHand = null;
            store.dispatch({ type: 'walk/leash', lane: null });
          },
          cancel() {
            leashHand = null;
          },
        },
        frame(dtMs) {
          const w = store.getState().walk;
          if (!w) return;
          scene.layout(stage.app.screen.width, stage.app.screen.height);
          scene.update(dtMs, w, leashHand);
          hud.update(w);
          for (; barks < w.barks.length; barks++) sfx.play('bark');
        },
      };
    };

    // ---------------------------------------------------------- concours (F-CON)
    const showContests = (): void => {
      openContests(
        {
          coins: () => store.getState().save.coins,
          dogName: () => dogOf()?.name ?? '',
          info: (c) => {
            const d = dogOf();
            const check = d ? canEnter(d, c) : null;
            return {
              contestClass: d?.contestClass[c] ?? 0,
              trophies: d?.trophies.filter((t) => t.contestId === c).length ?? 0,
              refusal: check && !check.ok ? check.reason : null,
            };
          },
          prizesLeft: () => prizeLeft(store.getState().save, aid()),
          obedience: () => {
            const d = dogOf();
            return d ? dogObedience(d) : 0;
          },
          enter: (c) => startContest(c),
        },
        () => undefined,
      );
    };

    const startContest = (c: ContestId): void => {
      store.dispatch({ type: 'contest/enter', contestId: c });
      const s0 = store.getState().contest;
      const d0 = dogOf();
      if (!s0 || !d0) return;
      const salon = mode;
      const scene = new ContestScene(breedOf(d0.breedId), d0.coat, () => dogOf()?.equipped ?? [], s0, seasonNow(Date.now()));
      scene.layout(stage.app.screen.width, stage.app.screen.height);
      stage.app.stage.addChild(scene.container);
      stage.setCamera(0);
      stage.world.visible = false;
      document.body.dataset.mode = 'contest';
      music.setScene('contest');
      voice.orderHook = (trickId) => store.dispatch({ type: 'contest/order', trickId });
      if (window.__truffe) window.__truffe.fieldToScreen = (p) => scene.screenOf(p);
      const back = (): void => {
        hud.destroy();
        scene.container.destroy({ children: true });
        stage.world.visible = true;
        voice.orderHook = null;
        store.dispatch({ type: store.getState().contest?.result ? 'contest/close' : 'contest/quit' });
        save();
        mode = salon;
        document.body.dataset.mode = 'living';
        music.setScene('home');
      };
      const hud = mountContestHud(s0, {
        quit: back,
        close: back,
        order: (trickId, precision) => store.dispatch(precision === undefined ? { type: 'contest/order', trickId } : { type: 'contest/order', trickId, precision }),
        tricks: () => (dogOf()?.tricks ?? []).filter((t) => t.learned).map((t) => ({ id: t.trickId, label: t.command.label })),
        micSupported: () => voice.supported(),
        micHold: (start) => (start ? void voice.holdStart() : voice.holdEnd()),
        dogName: () => dogOf()?.name ?? '',
      });
      // Geste du disque : la vitesse du doigt sur ses 100 dernières millisecondes.
      let trail: { x: number; y: number; t: number }[] = [];
      let saved = false;
      const aim = (x: number, y: number): void => {
        if (store.getState().contest?.run.kind === 'agility') store.dispatch({ type: 'contest/aim', at: scene.toField(x, y) });
      };
      mode = {
        intercept: {
          down(x, y, t) {
            trail = [{ x, y, t }];
            aim(x, y);
            return true;
          },
          move(x, y, t) {
            if (trail.length === 0) return;
            trail.push({ x, y, t });
            trail = trail.filter((p) => t - p.t <= 100);
            aim(x, y);
          },
          up(x, y, t) {
            const run = store.getState().contest?.run;
            if (run?.kind === 'disc' && trail.length > 0) {
              const first = trail.find((p) => t - p.t <= 100) ?? trail[0];
              if (first) {
                const dt = Math.max(16, t - first.t);
                store.dispatch({ type: 'contest/throw', fx: (x - first.x) / dt, fy: (first.y - y) / dt });
              }
            }
            if (run?.kind === 'agility') store.dispatch({ type: 'contest/aim', at: null });
            trail = [];
          },
          cancel() {
            trail = [];
            store.dispatch({ type: 'contest/aim', at: null });
          },
        },
        frame(dtMs, t) {
          const c = store.getState().contest;
          if (!c) return;
          scene.layout(stage.app.screen.width, stage.app.screen.height);
          for (const e of scene.update(dtMs, c, t)) sfx.play(e);
          hud.update(c);
          if (c.result && !saved) {
            saved = true;
            save();
          }
        },
      };
    };

    // ---------------------------------------------------------- chenil et pension
    const showKennel = (): void => {
      if (store.getState().save.dogs.length >= BALANCE.family.maxDogs) {
        toast(FAMILY.full);
        return;
      }
      const salon = mode;
      layer.visible = false;
      const restore = (): void => {
        layer.visible = true;
        mode = salon;
        recognizerRef.current = recognizer;
        document.body.dataset.mode = 'living';
      };
      void kennel({
        exit: restore,
        adopted: (id) => {
          restore();
          sync();
          if (store.getState().save.homeDogIds.includes(id)) store.dispatch({ type: 'family/select', dogId: id });
          else toast(FAMILY.toHotelToast);
        },
      });
    };

    const showFamily = (): void => {
      openFamily(
        {
          dogs: () => {
            const s = store.getState().save;
            return s.dogs.map((d) => ({ id: d.id, name: d.name, breed: breedOf(d.breedId).label, home: s.homeDogIds.includes(d.id) }));
          },
          move(id, to) {
            const s = store.getState().save;
            const home = s.homeDogIds.length;
            if (to === 'home' && home >= BALANCE.family.maxHome) return FAMILY.homeFull;
            if (to === 'hotel' && home <= 1) return FAMILY.lastHome;
            if (to === 'hotel' && s.dogs.length - home >= BALANCE.family.maxHotel) return FAMILY.hotelFull;
            store.dispatch({ type: 'family/move', dogId: id, to });
            sync();
            save();
            return null;
          },
          decors: () => {
            const s = store.getState().save;
            const open = availableDecors(s.masterPoints);
            return (['home', 'seaside', 'space'] as const).map((id) => ({ id, unlocked: open.includes(id), current: s.settings.decor === id }));
          },
          setDecor(id: DecorId) {
            store.dispatch({ type: 'settings/decor', decor: id });
            save();
          },
        },
        () => undefined,
      );
    };

    const hudApi = mountHud(document.body, {
      training,
      items: {
        owned: () => {
          const s0 = store.getState().save;
          const worn = dogOf()?.equipped ?? [];
          return Object.entries(s0.inventory)
            .filter(([id, n]) => n > 0 && !ITEM_BY_ID[id]?.pack)
            .map(([id, count]) => ({ id, count, worn: worn.includes(id) }));
        },
        use(id) {
          sfx.unlock();
          store.dispatch({ type: 'use', itemId: id });
          save();
        },
        equip(id) {
          store.dispatch({ type: 'equip', itemId: id });
          save();
        },
        armToy(id) {
          sfx.unlock();
          const kind = ITEM_BY_ID[id]?.toyKind;
          if (kind) hand.arm(kind, id);
        },
      },
      openOutings: () => openOutings(outings, () => undefined),
      openSettings: () => showSettings(),
      openBook: () => openBook(outings, () => undefined),
      openWorkshop: () => {
        let attempts = 0;
        openWorkshop(
          {
            dogName: () => dogOf()?.name || KENNEL.renameTitle,
            dogLevel: () => levelOf(dogOf()?.xp ?? 0).level,
            trick: (id) => {
              const d = dogOf();
              const t = d?.tricks.find((x) => x.trickId === id);
              return {
                learned: t?.learned ?? false,
                reps: t?.repetitions ?? 0,
                needed: d ? repsNeeded(d.traits, d.affection) : 3,
                canLearn: d ? canLearnNew(d, store.getState().save.day.perDog[d.id]?.newTricks ?? 0) : false,
              };
            },
            seed: () => (store.getState().save.rngState + 7919 * ++attempts) >>> 0,
            perform: (id) => store.dispatch({ type: 'gesture', gesture: { kind: 'perform', trick: id } }),
            done: (id) => {
              store.dispatch({ type: 'workshop/done', trickId: id });
              void autosave.saveNow();
            },
          },
          () => undefined,
        );
      },
      micHold(start) {
        sfx.unlock();
        music.unlock();
        if (start) void voice.holdStart();
        else voice.holdEnd();
      },
      ropeUnlocked: () => ropeUnlocked(store.getState().save.masterPoints),
      toysOut: () => store.getState().toys.filter((t) => t.state === 'ground' || t.state === 'held').length,
      putAwayToys: () => {
        store.dispatch({ type: 'toy/putAwayAll' });
        basketGot(performance.now() + 700);
      },
      dropBowl(kind, at) {
        sfx.unlock();
        const floor = at ? stage.room.screenToFloor(at.x, at.y) : null;
        store.dispatch({ type: 'care/bowl', kind, at: floor });
      },
      setTool(t) {
        tool = t;
      },
      bath() {
        sfx.unlock();
        startBath();
      },
      chores() {
        sfx.unlock();
        startChores();
      },
      dirtCount: () => store.getState().save.dirt.length,
      kibble: () => store.getState().save.inventory[BALANCE.kibble.itemId] ?? 0,
      armToy(kind) {
        sfx.unlock();
        hand.arm(kind);
      },
      card() {
        const d = dogOf();
        const m = store.getState().minds[aid()];
        return {
          rows: NEED_KINDS.map((kind) => {
            const level = needLevel(kind, d?.needs[kind] ?? 0);
            return { kind, level, word: NEED_WORDS[kind][level], value: d?.needs[kind] ?? 0 };
          }),
          asleep: m?.activity === 'sleep',
          name: d?.name || KENNEL.renameTitle,
          breed: breedOf(d?.breedId).label,
          sex: d?.sex ?? 'm',
          temperament: d?.temperament ?? 'joueur',
          obedience: d && d.tricks.some((t) => t.learned) ? dogObedience(d) : null,
          levels: { dog: levelOf(d?.xp ?? 0), player: levelOf(store.getState().save.xp) },
        };
      },
      status() {
        const s = store.getState();
        const d = dogOf();
        return {
          // D-87 : le nom du chiot à côté de son niveau, pour ne pas le confondre avec celui du joueur.
          name: d ? d.name || KENNEL.renameTitle : null,
          level: levelOf(d?.xp ?? 0).level,
          player: levelOf(s.save.xp),
          xp: { player: s.save.xp, dog: d?.xp ?? 0, dogId: d?.id ?? '' },
          rows: NEED_KINDS.map((kind) => {
            const v = d?.needs[kind] ?? 0;
            const level = needLevel(kind, v);
            return { kind, level, word: NEED_WORDS[kind][level], value: v };
          }),
        };
      },
      onStatus(fn) {
        store.subscribe(() => fn());
      },
      onChange(fn) {
        let last = '';
        store.subscribe(() => {
          const d = dogOf();
          const key = d ? aid() + NEED_KINDS.map((k) => needLevel(k, d.needs[k])).join() + (store.getState().minds[aid()]?.activity === 'sleep') + d.name : '';
          if (key !== last) {
            last = key;
            fn();
          }
        });
      },
    });

    toast = hudApi.toast;

    // Sons de chaque chiot ; annonces des déblocages.
    let bulbHinted = false;
    let tier = store.getState().save.unlockTier;
    // D-78 : annonces des niveaux.
    let playerLevel = levelOf(store.getState().save.xp).level;
    const dogLevels = new Map(store.getState().save.dogs.map((d) => [d.id, levelOf(d.xp).level]));
    store.subscribe((s) => {
      const pl = levelOf(s.save.xp).level;
      const said: string[] = [];
      if (pl > playerLevel) {
        let coins = 0;
        for (let lv = playerLevel + 1; lv <= pl; lv++) coins += BALANCE.levels.playerLevelCoins * lv;
        said.push(LEVELS.playerUp.replace('{n}', String(pl)).replace('{c}', String(coins)));
        sfx.play('learned');
      }
      playerLevel = pl;
      for (const d of s.save.dogs) {
        const lv = levelOf(d.xp).level;
        const was = dogLevels.get(d.id);
        if (was !== undefined && lv > was) said.push(LEVELS.dogUp.replace('{name}', d.name || KENNEL.renameTitle).replace('{n}', String(lv)));
        dogLevels.set(d.id, lv);
      }
      if (said.length > 0) toast(said.join(' '));
      for (const id of s.save.homeDogIds) {
        const m = s.minds[id];
        if (!m) continue;
        let seq = heard.get(id) ?? 0;
        for (const e of m.events) {
          if (e.seq <= seq) continue;
          seq = e.seq;
          sfx.play(e.type);
          if (e.type === 'learned') toast(TRAINING.learnedToast);
          if (e.type === 'bulb' && !bulbHinted) {
            bulbHinted = true;
            toast(TRAINING.bulbHint);
          }
        }
        heard.set(id, seq);
      }
      for (; tier < s.save.unlockTier; tier++) {
        const c = tierContent(tier);
        if (!c) continue;
        const said: string[] = [];
        const items: readonly string[] = c.items;
        if (items.includes('ballon')) said.push(UNLOCKS.rope);
        if (items.includes('canape')) said.push(UNLOCKS.sofa);
        if (items.includes('souris-meca')) said.push(UNLOCKS.toy);
        for (const b of c.breeds) said.push(b === 'dalmatien' ? UNLOCKS.secret : UNLOCKS.breed.replace('{breed}', breedOf(b).label));
        if (c.decor) said.push(UNLOCKS.decor.replace('{decor}', DECOR_NAMES[c.decor]));
        toast(`${UNLOCKS.title} ${said.join(' ')}`);
      }
    });

    mode = {
      intercept: {
        down: (x, y, t) => {
          // F-DRE-1 : toucher l'ampoule associe un ordre.
          for (const [id, v] of views) {
            if (v.bulbAt(x, y)) {
              store.dispatch({ type: 'family/select', dogId: id });
              store.dispatch({ type: 'train' });
              void autosave.saveNow();
              return true;
            }
          }
          // D-74 : toucher un besoin le ramasse.
          const poop = poopsView.hitTest(x, y);
          if (poop) {
            const forgotten = store.getState().save.poops.find((p) => p.id === poop)?.forgotten ?? false;
            store.dispatch({ type: 'poop/pickup', poopId: poop });
            toast(forgotten ? UI.poopForgotten : UI.poopPicked);
            sfx.tool('brush');
            save();
            return true;
          }
          // D-89 : un repère au bord de l'écran emmène la vue vers ce chiot.
          const far = edgeAt(x, y);
          if (far) {
            const m = store.getState().minds[far];
            if (m) viewCam = clampView(camFor(m.pos));
            store.dispatch({ type: 'family/select', dogId: far });
            return true;
          }
          // D-61 : toucher un chiot en fait le chiot actif.
          const hit = dogAt(x, y);
          if (hit && hit !== aid()) store.dispatch({ type: 'family/select', dogId: hit });
          const toy = hand.down(x, y, t);
          // Toucher le chiot : une main apparaît sous le doigt.
          if (hit && !toy && !tool) hudApi.petting({ x, y });
          press = { x, y, free: !hit && !toy && !tool };
          return toy;
        },
        // D-89 : un glissé surtout horizontal, commencé à côté des chiots, fait glisser la vue.
        steal: (x, y) => {
          if (!press?.free || panning) return false;
          const dx = x - press.x;
          const dy = y - press.y;
          if (Math.abs(dx) < BALANCE.gestures.panMinPx || Math.abs(dx) < 1.3 * Math.abs(dy)) return false;
          panning = { x0: press.x, cam0: viewCam };
          return true;
        },
        move: (x, y, t) => {
          if (panning) {
            viewCam = clampView(panning.cam0 + (x - panning.x0));
            return;
          }
          hand.move(x, y, t);
        },
        up: (x, y, t) => {
          press = null;
          if (panning) {
            panning = null;
            return;
          }
          hand.up(x, y, t);
        },
        cancel: () => {
          press = null;
          panning = null;
          hand.cancel();
        },
      },
      frame(dtMs, t) {
        recognizer.update(t);
        const s = store.getState();
        if (views.size !== s.save.homeDogIds.length) sync();
        const active = aid();
        for (const [id, v] of views) {
          const m = s.minds[id];
          const d = s.save.dogs.find((x) => x.id === id);
          if (m && d) v.update(dtMs, m, id === active ? (hand.hand ?? recognizer.pointerAt(t)) : null, d.needs.cleanliness, d.equipped);
        }
        // Avec plusieurs chiots, un anneau discret sous le chiot actif.
        ring.clear();
        const am = s.minds[active];
        if (views.size > 1 && am) {
          const f = stage.room.floorToScreen(am.pos);
          const k = f.s * breedOf(s.save.dogs.find((d) => d.id === active)?.breedId).size;
          ring.ellipse(f.x, f.y, k * 0.4, k * 0.11).stroke({ width: 3, color: 0xb5562a, alpha: 0.45 });
        }
        followCamera(dtMs, s);
        drawEdges(s);
        showBasket(t);
        bowls.update(s.bowls, am);
        poopsView.update(s.save.poops, t);
        dirtView.update(s.save.dirt, document.body.dataset.mode === 'chores');
        toysView.update(dtMs, s.toys, hand.hand, (id) => {
          const v = views.get(id);
          if (!v) return null;
          const p = v.mouthScreen();
          return { ...p, z: v.container.zIndex + 0.001 };
        });
      },
    };

    if (DEBUG) {
      const debugProbe: DebugProbe = { store, dogId: aid(), latencies, probe, fps: () => stage.app.ticker.FPS, rewind: (ms) => rewind(store, ms), bulb: () => av()?.bulbScreen() ?? null, poopsOnScreen: () => poopsView.targets(), dirtOnScreen: () => dirtView.targets(), camera: () => stage.room.camX, edges: () => edgeMarks };
      mountDebug(debugProbe);
    }

    // Chiot des jalons 1 et 2 : il ne lui manque qu'un nom.
    const unnamed = unnamedDogs(store.getState().save)[0];
    if (unnamed) {
      nameDialog(document.body, KENNEL.renameTitle, (raw) => {
        const r = validateName(raw);
        if (!r.ok) return NAME_ERRORS[r.reason];
        store.dispatch({ type: 'rename', dogId: unnamed.id, name: r.name });
        void autosave.saveNow();
        return null;
      });
    }
    document.body.dataset.mode = 'living';
  }

  // ------------------------------------------------------------ chenil
  /** Sans options : premier chiot, puis le salon. Depuis le salon : on peut repartir. */
  async function kennel(opts?: { exit: () => void; adopted: (id: DogId) => void }): Promise<void> {
    document.body.dataset.mode = 'kennel';
    const breedIds = availableBreeds(store.getState().save.masterPoints);
    const pics = await portraits(stage, breedIds);
    const salonRecognizer = recognizerRef.current;
    recognizerRef.current = null;
    const layer = new Container();
    layer.sortableChildren = true;
    stage.world.addChild(layer);
    const ring = new Graphics();
    layer.addChild(ring);
    let pups: { view: PuppyView; mind: PuppyMind; c: Candidate; foot: { x: number; y: number } }[] = [];
    let chosen: number | null = null;
    /** Les trois chiots tiennent côte à côte, même sur un écran étroit. */
    const KENNEL_SCALE = 0.62;
    const KENNEL_Z = 0.4;
    const toLocal = (p: { x: number; y: number }, foot: { x: number; y: number }) => ({
      x: foot.x + (p.x - foot.x) / KENNEL_SCALE,
      y: foot.y + (p.y - foot.y) / KENNEL_SCALE,
    });
    const leave = (): void => {
      ui.destroy();
      layer.destroy({ children: true });
      store.dispatch({ type: 'kennel/close' });
      recognizerRef.current = salonRecognizer;
    };

    const ui = mountKennel(document.body, {
      breeds: breedIds.map((id) => {
        const b = BREEDS[id];
        return {
          id,
          label: b?.label ?? id,
          price: b ? adoptionPrice(store.getState().save, id) : 0,
          portrait: pics[id] ?? null,
          coatLabel: (base: number) => (b ? coatOf(b, base).label : ''),
        };
      }),
      open(breedId) {
        store.dispatch({ type: 'kennel/open', breedId });
        const litter = store.getState().kennel?.litter ?? [];
        for (const p of pups) p.view.container.destroy({ children: true });
        const breed = BREEDS[breedId];
        pups = breed
          ? litter.map((c, i) => {
              const y = stage.room.floorToScreen({ x: 0, z: KENNEL_Z }).y;
              const xs = stage.app.screen.width * (0.18 + 0.32 * i);
              const floor = stage.room.screenToFloor(xs, y) ?? { x: 0, z: KENNEL_Z };
              const pos = { x: floor.x, z: KENNEL_Z };
              const view = new PuppyView(breed, c.coat as CoatParams, stage.room, pos);
              const foot = stage.room.floorToScreen(pos);
              view.container.pivot.set(foot.x, foot.y);
              view.container.position.set(foot.x, foot.y);
              view.container.scale.set(KENNEL_SCALE);
              layer.addChild(view.container);
              return { view, mind: staticMind(pos, KENNEL_MOOD[c.temperament], (i - 1) * -0.5), c, foot };
            })
          : [];
        chosen = null;
        return litter;
      },
      back() {
        store.dispatch({ type: 'kennel/close' });
        for (const p of pups) p.view.container.destroy({ children: true });
        pups = [];
      },
      highlight(i) {
        chosen = i;
      },
      adopt(index, raw) {
        const r = validateName(raw);
        if (!r.ok) return NAME_ERRORS[r.reason];
        const t = Date.now();
        const count = store.getState().save.dogs.length;
        store.dispatch({ type: 'adopt', index, name: r.name, now: t, tzOffsetMin: tz(t) });
        const s = store.getState();
        const dog = s.save.dogs.at(-1);
        if (!dog || s.save.dogs.length === count) return s.save.coins < adoptionPrice(s.save, s.kennel?.breedId ?? '') ? OUT.notEnough : NAME_ERRORS.chars;
        void autosave.saveNow();
        leave();
        if (opts) opts.adopted(dog.id);
        else living();
        return null;
      },
      exit: opts
        ? () => {
            leave();
            opts.exit();
          }
        : undefined,
    });

    mode = {
      intercept: {
        down(x, y) {
          const i = pups.findIndex((p) => {
            const l = toLocal({ x, y }, p.foot);
            return p.view.probe.hitTest(l.x, l.y) !== null;
          });
          if (i >= 0) ui.pickAt(i);
          return true;
        },
        move: () => undefined,
        up: () => undefined,
        cancel: () => undefined,
      },
      frame(dtMs) {
        ring.clear();
        pups.forEach((p, i) => {
          const happy = chosen === i;
          const mind = happy ? { ...p.mind, mood: 'happy' as const, excitement: 1, posture: 'stand' as const } : p.mind;
          p.view.update(dtMs, mind, null);
          if (happy) {
            const f = stage.room.floorToScreen(mind.pos);
            const k = f.s * KENNEL_SCALE * (BREEDS[p.c.breedId]?.size ?? 1);
            ring.ellipse(f.x, f.y, k * 0.42, k * 0.12).stroke({ width: 4, color: 0xb5562a, alpha: 0.8 });
          }
        });
      },
    };
  }

  // ------------------------------------------------------------ galerie de silhouettes (?debug&gallery)
  function gallery(): void {
    const w = stage.app.screen.width;
    const h = stage.app.screen.height;
    const layer = new Container();
    stage.app.stage.addChild(layer);
    const bg = new Graphics().rect(0, 0, w, h).fill(0xfdf6ea);
    layer.addChild(bg);
    const views: { view: PuppyView; mind: PuppyMind }[] = [];
    const only = params.get('breed');
    const ids = only ? [only] : Object.keys(BREEDS);
    const rows = Math.ceil(ids.length / 2);
    ids.forEach((id, i) => {
      const breed = BREEDS[id];
      if (!breed) return;
      const room = new Room();
      room.layout(only ? w : w / 2, h / rows);
      const view = new PuppyView(breed, { base: 0, patch: 0, patchAmount: 1 }, room, { x: 0, z: 0.85 });
      view.container.position.set((i % 2) * (w / 2), Math.floor(i / 2) * (h / rows) - (h / rows) * 0.18);
      if (params.has('silhouette')) view.container.tint = 0x2b2320;
      layer.addChild(view.container);
      views.push({ view, mind: { ...staticMind({ x: 0, z: 0.85 }, 'calm', Math.PI / 2), posture: 'stand' } });
    });
    // &trick=roll : chaque chiot refait ce tour en boucle (vérifier une animation sur toutes les races).
    const trick = params.get('trick') as TrickId | null;
    const facing = Number(params.get('facing') ?? Math.PI / 2);
    for (const v of views) v.mind = { ...v.mind, facing };
    let nextTrickAt = 600;
    let galleryT = 0;
    const slow = Number(params.get('slow') ?? 1);
    // &at=800 : image figée 800 ms après le début du tour (captures reproductibles).
    const at = params.get('at');
    if (trick && at !== null) {
      for (const v of views) {
        for (let i = 0; i < 20; i++) v.view.update(50, v.mind, null);
        v.mind = performTrick(v.mind, trick);
        for (let ms = 0; ms < Number(at); ms += 16) {
          v.mind = { ...v.mind, t: v.mind.t + 16 };
          v.view.update(16, v.mind, null);
        }
      }
    }
    document.body.dataset.mode = 'gallery';
    mode = {
      intercept: { down: () => true, move: () => undefined, up: () => undefined, cancel: () => undefined },
      frame(realDt) {
        if (at !== null) return;
        const dtMs = realDt * slow;
        galleryT += dtMs;
        const def = trick ? TRICKS[trick] : undefined;
        if (trick && def && galleryT >= nextTrickAt) {
          nextTrickAt = galleryT + def.durationMs + 1500;
          for (const v of views) v.mind = performTrick(v.mind, trick);
        }
        for (const v of views) {
          v.mind = { ...v.mind, t: v.mind.t + dtMs };
          v.view.update(dtMs, v.mind, null);
        }
      },
    };
  }

  // ------------------------------------------------------------ démarrage
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const t = Date.now();
      store.dispatch({ type: 'session/resume', now: t, tzOffsetMin: tz(t) });
    }
  });

  const quick = DEBUG ? params.get('adopt') : null;
  if (DEBUG && params.has('gallery')) gallery();
  else if (store.getState().save.homeDogIds[0]) living();
  else if (quick && BREEDS[quick]) {
    // Raccourci de test : adoption immédiate du premier chiot de la race.
    store.dispatch({ type: 'kennel/open', breedId: quick });
    store.dispatch({ type: 'adopt', index: 0, name: 'Truffe', now: Date.now(), tzOffsetMin: tz(Date.now()) });
    living();
  } else await kennel();
  document.body.dataset.ready = 'true';
}

boot().catch((e: unknown) => {
  console.error(e);
  document.body.textContent = 'Truffe n’a pas pu démarrer. Rechargez la page.';
});
