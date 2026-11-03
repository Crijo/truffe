import './style.css';
import { Sfx } from './audio/sfx';
import { startAutosave } from './core/autosave';
import { FixedStepper } from './core/loop';
import { GameStore } from './core/store';
import { BALANCE } from './data/balance';
import { BREEDS } from './data/breeds';
import { GestureRecognizer } from './input/gestures';
import { bindPointer } from './input/pointer';
import { PuppyView } from './render/puppy/PuppyView';
import { createStage } from './render/stage';
import { openSaveStore } from './save/storage';
import { createGameState, createNewGame } from './sim/game';
import { mountDebug, type DebugProbe } from './ui/debug';

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
  const dog = state.save.dogs[0];
  const dogId = state.save.homeDogIds[0];
  const firstMind = dogId ? state.minds[dogId] : undefined;
  const breed = BREEDS[dog?.breedId ?? 'beagle'] ?? BREEDS.beagle;
  if (!dog || !dogId || !firstMind || !breed) throw new Error('aucun chiot');

  const view = new PuppyView(breed, stage.room, firstMind.pos);
  stage.world.addChild(view.container);

  const sfx = new Sfx(state.save.settings.sfxVolume);
  let lastInputAt = 0;
  const recognizer = new GestureRecognizer(view.probe, (gesture) => {
    // Main présentée ou levée : le geste est reconnu après un maintien, la latence part de là.
    if (['present', 'presentEnd', 'raise', 'raiseEnd'].includes(gesture.kind)) lastInputAt = performance.now();
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
    const mind = store.getState().minds[dogId];
    if (mind) view.update(ticker.deltaMS, mind, recognizer.pointerAt(t));
  });

  // F-VIE-2 : retour sur l'onglet.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const t = Date.now();
      store.dispatch({ type: 'session/resume', now: t, tzOffsetMin: tz(t) });
    }
  });

  if (new URLSearchParams(location.search).has('debug')) {
    const probe: DebugProbe = { store, dogId, latencies, probe: view.probe, fps: () => stage.app.ticker.FPS };
    mountDebug(probe);
  }
  document.body.dataset.ready = 'true';
}

boot().catch((e: unknown) => {
  console.error(e);
  document.body.textContent = 'Truffe n’a pas pu démarrer. Rechargez la page.';
});
