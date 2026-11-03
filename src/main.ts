import './style.css';
import { Container, Graphics, Rectangle } from 'pixi.js';
import { Sfx } from './audio/sfx';
import { startAutosave } from './core/autosave';
import { FixedStepper } from './core/loop';
import { GameStore } from './core/store';
import { BALANCE } from './data/balance';
import { BREEDS, STARTER_BREEDS, coatOf, type BreedLook } from './data/breeds';
import { KENNEL, NAME_ERRORS, NEED_WORDS, TRAINING } from './data/strings';
import { GestureRecognizer } from './input/gestures';
import { bindPointer, type PointerIntercept } from './input/pointer';
import { ToyHand } from './input/toyHand';
import { BowlsView } from './render/bowls';
import { PuppyView } from './render/puppy/PuppyView';
import { Room } from './render/room';
import { createStage, type Stage } from './render/stage';
import { ToysView } from './render/toys';
import { openSaveStore } from './save/storage';
import { adoptionPrice, validateName, type Candidate } from './sim/adoption';
import { createMind, type CareTool, type Mood, type PuppyMind } from './sim/behavior';
import { createGameState, createNewGame, unnamedDogs } from './sim/game';
import { NEED_KINDS, localHour, needLevel } from './sim/needs';
import type { CoatParams, DogId, TemperamentId } from './sim/state';
import { mountDebug, rewind, type DebugProbe } from './ui/debug';
import { mountHud } from './ui/hud';
import { mountKennel, nameDialog } from './ui/kennel';
import type { TrainingHandlers } from './ui/training';
import { VoiceController } from './ui/voice';
import { repsNeeded } from './sim/tricks';

const tz = (now: number): number => new Date(now).getTimezoneOffset();
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

/** Humeur affichée au chenil : le tempérament se voit avant l'adoption. */
const KENNEL_MOOD: Record<TemperamentId, Mood> = { sage: 'content', joueur: 'happy', timide: 'startled', tetu: 'calm' };

/** Ce que fait la scène à chaque image, selon l'écran en cours. */
interface Mode {
  frame(dtMs: number, t: number): void;
  intercept: PointerIntercept;
}

function staticMind(pos: { x: number; z: number }, mood: Mood, facing = 0): PuppyMind {
  const m = createMind(1, pos);
  return { ...m, posture: 'sit', mood, facing, excitement: mood === 'happy' ? 0.9 : 0.4 };
}

/** Portraits des races pour les cartes du chenil, dessinés une fois. */
async function portraits(stage: Stage): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const room = new Room();
  room.layout(400, 460);
  for (const id of STARTER_BREEDS) {
    const breed = BREEDS[id];
    if (!breed) continue;
    const view = new PuppyView(breed, { base: 0, patch: 0, patchAmount: 1 }, room, { x: 0, z: 0.75 });
    const mind = { ...staticMind({ x: 0, z: 0.75 }, 'happy', 0.55), posture: 'stand' as const };
    for (let i = 0; i < 40; i++) view.update(50, mind, null);
    // Cadre autour du chiot : un Graphics vide placé à l'origine fausserait les bornes.
    const f = room.floorToScreen({ x: 0, z: 0.75 });
    const k = f.s * breed.size;
    const frame = new Rectangle(f.x - k * 0.85, f.y - k * 1.25, k * 1.7, k * 1.4);
    out[id] = await stage.app.renderer.extract.base64({ target: view.container, frame });
    view.container.destroy({ children: true });
  }
  return out;
}

async function boot(): Promise<void> {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app introuvable');

  const saves = await openSaveStore();
  const now = Date.now();
  const loaded = await saves.load();
  const store = new GameStore(createGameState(loaded ?? createNewGame(now, (Math.random() * 2 ** 32) >>> 0)));
  store.dispatch({ type: 'session/start', now, tzOffsetMin: tz(now) });
  const autosave = startAutosave(store, saves);
  await autosave.saveNow();

  const stage = await createStage(host);
  const sfx = new Sfx(store.getState().save.settings.sfxVolume);
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
  };
  bindPointer(
    stage.app.canvas,
    () => recognizerRef.current,
    (t) => {
      lastInputAt = t;
      sfx.unlock();
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
    stage.setHour(localHour(s.save.lastSeenAt, tz(s.save.lastSeenAt)));
    mode?.frame(ticker.deltaMS, performance.now());
  });

  // ------------------------------------------------------------ salon
  function living(dogId: DogId): void {
    const state = store.getState();
    const dogOf = () => store.getState().save.dogs.find((d) => d.id === dogId);
    const dog = dogOf();
    const firstMind = state.minds[dogId];
    const breed: BreedLook | undefined = BREEDS[dog?.breedId ?? 'beagle'] ?? BREEDS.beagle;
    if (!dog || !firstMind || !breed) throw new Error('aucun chiot');

    const view = new PuppyView(breed, dog.coat, stage.room, firstMind.pos);
    stage.world.addChild(view.container);
    const bowls = new BowlsView(stage.world, stage.room);
    const toysView = new ToysView(stage.world, stage.room);
    let tool: CareTool | null = null;

    const recognizer = new GestureRecognizer(view.probe, (gesture) => {
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
      mouth: () => view.mouthScreen(),
    });
    view.onReaction = () => {
      if (lastInputAt > 0) latencies.push(performance.now() - lastInputAt);
      if (latencies.length > 50) latencies.shift();
    };

    let toast: (text: string) => void = () => undefined;
    const voice = new VoiceController(store, dogId, (t) => toast(t), () => void autosave.saveNow());
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

    const hudApi = mountHud(document.body, {
      training,
      micHold(start) {
        sfx.unlock();
        if (start) void voice.holdStart();
        else voice.holdEnd();
      },
      dropBowl(kind, at) {
        sfx.unlock();
        const floor = at ? stage.room.screenToFloor(at.x, at.y) : null;
        store.dispatch({ type: 'care/bowl', kind, at: floor });
      },
      setTool(t) {
        tool = t;
      },
      bath(start) {
        sfx.unlock();
        store.dispatch({ type: 'gesture', gesture: { kind: start ? 'groomStart' : 'groomEnd' } });
      },
      armToy(kind) {
        sfx.unlock();
        hand.arm(kind);
      },
      card() {
        const d = dogOf();
        const m = store.getState().minds[dogId];
        return {
          rows: NEED_KINDS.map((kind) => {
            const level = needLevel(kind, d?.needs[kind] ?? 0);
            return { kind, level, word: NEED_WORDS[kind][level] };
          }),
          asleep: m?.activity === 'sleep',
          name: d?.name || KENNEL.renameTitle,
          breed: breed.label,
          sex: d?.sex ?? 'm',
          temperament: d?.temperament ?? 'joueur',
        };
      },
      onChange(fn) {
        let last = '';
        store.subscribe(() => {
          const d = dogOf();
          const key = d ? NEED_KINDS.map((k) => needLevel(k, d.needs[k])).join() + (store.getState().minds[dogId]?.activity === 'sleep') + d.name : '';
          if (key !== last) {
            last = key;
            fn();
          }
        });
      },
    });

    toast = hudApi.toast;

    // Sons : chaque nouvel événement du chiot.
    let heardSeq = firstMind.events.at(-1)?.seq ?? 0;
    let bulbHinted = false;
    store.subscribe((s) => {
      const m = s.minds[dogId];
      if (!m) return;
      for (const e of m.events) {
        if (e.seq > heardSeq) {
          heardSeq = e.seq;
          sfx.play(e.type);
          if (e.type === 'learned') toast(TRAINING.learnedToast);
          if (e.type === 'bulb' && !bulbHinted) {
            bulbHinted = true;
            toast(TRAINING.bulbHint);
          }
        }
      }
    });

    mode = {
      intercept: {
        down: (x, y, t) => {
          // F-DRE-1 : toucher l'ampoule associe un ordre.
          if (view.bulbAt(x, y)) {
            store.dispatch({ type: 'train' });
            void autosave.saveNow();
            return true;
          }
          return hand.down(x, y, t);
        },
        move: (x, y, t) => hand.move(x, y, t),
        up: (x, y, t) => hand.up(x, y, t),
        cancel: () => hand.cancel(),
      },
      frame(dtMs, t) {
        recognizer.update(t);
        const s = store.getState();
        const mind = s.minds[dogId];
        if (mind) view.update(dtMs, mind, hand.hand ?? recognizer.pointerAt(t), dogOf()?.needs.cleanliness ?? 100);
        bowls.update(s.bowls, mind);
        toysView.update(dtMs, s.toys, hand.hand, () => {
          const p = view.mouthScreen();
          return { ...p, z: view.container.zIndex + 0.001 };
        });
      },
    };

    if (DEBUG) {
      const probe: DebugProbe = { store, dogId, latencies, probe: view.probe, fps: () => stage.app.ticker.FPS, rewind: (ms) => rewind(store, ms), bulb: () => view.bulbScreen() };
      mountDebug(probe);
    }

    // Chiot des jalons 1 et 2 : il ne lui manque qu'un nom.
    if (unnamedDogs(store.getState().save).some((d) => d.id === dogId)) {
      nameDialog(document.body, KENNEL.renameTitle, (raw) => {
        const r = validateName(raw);
        if (!r.ok) return NAME_ERRORS[r.reason];
        store.dispatch({ type: 'rename', dogId, name: r.name });
        void autosave.saveNow();
        return null;
      });
    }
    document.body.dataset.mode = 'living';
  }

  // ------------------------------------------------------------ chenil
  async function kennel(): Promise<void> {
    document.body.dataset.mode = 'kennel';
    const pics = await portraits(stage);
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

    const ui = mountKennel(document.body, {
      breeds: STARTER_BREEDS.map((id) => {
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
        store.dispatch({ type: 'adopt', index, name: r.name, now: t, tzOffsetMin: tz(t) });
        const s = store.getState();
        const dog = s.save.dogs.at(-1);
        if (!dog || dog.name !== r.name) return NAME_ERRORS.chars;
        void autosave.saveNow();
        ui.destroy();
        layer.destroy({ children: true });
        living(dog.id);
        return null;
      },
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
    STARTER_BREEDS.forEach((id, i) => {
      const breed = BREEDS[id];
      if (!breed) return;
      const room = new Room();
      room.layout(w / 2, h / 3);
      const view = new PuppyView(breed, { base: 0, patch: 0, patchAmount: 1 }, room, { x: 0, z: 0.85 });
      view.container.position.set((i % 2) * (w / 2), Math.floor(i / 2) * (h / 3) - h * 0.06);
      if (params.has('silhouette')) view.container.tint = 0x2b2320;
      layer.addChild(view.container);
      views.push({ view, mind: { ...staticMind({ x: 0, z: 0.85 }, 'calm', Math.PI / 2), posture: 'stand' } });
    });
    document.body.dataset.mode = 'gallery';
    mode = {
      intercept: { down: () => true, move: () => undefined, up: () => undefined, cancel: () => undefined },
      frame(dtMs) {
        for (const v of views) v.view.update(dtMs, v.mind, null);
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
  else if (store.getState().save.homeDogIds[0]) living(store.getState().save.homeDogIds[0] ?? '');
  else if (quick && BREEDS[quick]) {
    // Raccourci de test : adoption immédiate du premier chiot de la race.
    store.dispatch({ type: 'kennel/open', breedId: quick });
    store.dispatch({ type: 'adopt', index: 0, name: 'Truffe', now: Date.now(), tzOffsetMin: tz(Date.now()) });
    living(store.getState().save.homeDogIds[0] ?? '');
  } else await kennel();
  document.body.dataset.ready = 'true';
}

boot().catch((e: unknown) => {
  console.error(e);
  document.body.textContent = 'Truffe n’a pas pu démarrer. Rechargez la page.';
});
