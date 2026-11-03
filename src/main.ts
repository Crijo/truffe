import './style.css';
import { startAutosave } from './core/autosave';
import { FixedStepper } from './core/loop';
import { GameStore } from './core/store';
import { BALANCE } from './data/balance';
import { createStage } from './render/stage';
import { openSaveStore } from './save/storage';
import { createNewGame } from './sim/game';
import { mountDebug } from './ui/debug';

async function boot(): Promise<void> {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app introuvable');

  const saves = await openSaveStore();
  const now = Date.now();
  const loaded = await saves.load();
  const store = new GameStore(loaded ?? createNewGame(now, (Math.random() * 2 ** 32) >>> 0));
  store.dispatch({ type: 'session/start', now });

  const autosave = startAutosave(store, saves);
  await autosave.saveNow();

  const stage = await createStage(host);
  const stepper = new FixedStepper(BALANCE.time.simStepMs, BALANCE.time.maxCatchUpSteps, (dtMs) =>
    store.dispatch({ type: 'tick', now: Date.now(), dtMs }),
  );
  stage.app.ticker.add((t) => stepper.advance(t.deltaMS));

  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) mountDebug(store);
  document.body.dataset.ready = 'true';
}

boot().catch((e: unknown) => {
  console.error(e);
  document.body.textContent = 'Truffe n’a pas pu démarrer. Rechargez la page.';
});
