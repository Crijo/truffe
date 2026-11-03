import './style.css';
import { Sfx } from './audio/sfx';
import { startAutosave } from './core/autosave';
import { FixedStepper } from './core/loop';
import { GameStore } from './core/store';
import { BALANCE } from './data/balance';
import { BREEDS } from './data/breeds';
import { NEED_WORDS } from './data/strings';
import { GestureRecognizer } from './input/gestures';
import { bindPointer } from './input/pointer';
import { BowlsView } from './render/bowls';
import { PuppyView } from './render/puppy/PuppyView';
import { createStage } from './render/stage';
import { openSaveStore } from './save/storage';
import type { CareTool } from './sim/behavior';
import { createGameState, createNewGame } from './sim/game';
import { NEED_KINDS, localHour, needLevel } from './sim/needs';
import { mountDebug, rewind, type DebugProbe } from './ui/debug';
import { mountHud } from './ui/hud';

const tz = (now: number): number => new Date(now).getTimezoneOffset();

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
  const state = store.getState();
  const dogId = state.save.homeDogIds[0];
  const dogOf = () => store.getState().save.dogs.find((d) => d.id === dogId);
  const firstMind = dogId ? state.minds[dogId] : undefined;
  const breed = BREEDS[dogOf()?.breedId ?? 'beagle'] ?? BREEDS.beagle;
  if (!dogId || !firstMind || !breed) throw new Error('aucun chiot');

  const view = new PuppyView(breed, stage.room, firstMind.pos);
  stage.world.addChild(view.container);
  const bowls = new BowlsView(stage.world, stage.room);

  const sfx = new Sfx(state.save.settings.sfxVolume);
  let tool: CareTool | null = null;
  let lastInputAt = 0;
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
  const latencies: number[] = [];
  bindPointer(stage.app.canvas, recognizer, (t) => {
    lastInputAt = t;
    sfx.unlock();
  });
  view.onReaction = () => {
    if (lastInputAt > 0) latencies.push(performance.now() - lastInputAt);
    if (latencies.length > 50) latencies.shift();
  };

  mountHud(document.body, {
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
    card() {
      const dog = dogOf();
      const m = store.getState().minds[dogId];
      return {
        rows: NEED_KINDS.map((kind) => {
          const level = needLevel(kind, dog?.needs[kind] ?? 0);
          return { kind, level, word: NEED_WORDS[kind][level] };
        }),
        asleep: m?.activity === 'sleep',
      };
    },
    onChange(fn) {
      let last = '';
      store.subscribe(() => {
        const d = dogOf();
        const key = d ? NEED_KINDS.map((k) => needLevel(k, d.needs[k])).join() + (store.getState().minds[dogId]?.activity === 'sleep') : '';
        if (key !== last) {
          last = key;
          fn();
        }
      });
    },
  });

  // Sons : chaque nouvel événement du chiot.
  let heardSeq = firstMind.events.at(-1)?.seq ?? 0;
  store.subscribe((s) => {
    const m = s.minds[dogId];
    if (!m) return;
    for (const e of m.events) {
      if (e.seq > heardSeq) {
        heardSeq = e.seq;
        sfx.play(e.type);
      }
    }
  });

  const stepper = new FixedStepper(BALANCE.time.simStepMs, BALANCE.time.maxCatchUpSteps, (dtMs) => {
    const t = Date.now();
    store.dispatch({ type: 'tick', now: t, dtMs, tzOffsetMin: tz(t) });
  });
  stage.app.ticker.add((ticker) => {
    stepper.advance(ticker.deltaMS);
    const t = performance.now();
    recognizer.update(t);
    const s = store.getState();
    const mind = s.minds[dogId];
    if (mind) view.update(ticker.deltaMS, mind, recognizer.pointerAt(t), dogOf()?.needs.cleanliness ?? 100);
    bowls.update(s.bowls, mind);
    stage.setHour(localHour(s.save.lastSeenAt, tz(s.save.lastSeenAt)));
  });

  // F-VIE-2 : retour sur l'onglet.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const t = Date.now();
      store.dispatch({ type: 'session/resume', now: t, tzOffsetMin: tz(t) });
    }
  });

  if (new URLSearchParams(location.search).has('debug')) {
    const probe: DebugProbe = { store, dogId, latencies, probe: view.probe, fps: () => stage.app.ticker.FPS, rewind: (ms) => rewind(store, ms) };
    mountDebug(probe);
  }
  document.body.dataset.ready = 'true';
}

boot().catch((e: unknown) => {
  console.error(e);
  document.body.textContent = 'Truffe n’a pas pu démarrer. Rechargez la page.';
});
