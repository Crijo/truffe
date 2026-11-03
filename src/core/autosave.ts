import { BALANCE } from '../data/balance';
import type { SaveStore } from '../save/storage';
import type { GameStore } from './store';

/** Sauvegarde toutes les 30 s et quand la page passe en arrière-plan. */
export function startAutosave(store: GameStore, saves: SaveStore): { saveNow(): Promise<void>; stop(): void } {
  let pending: Promise<void> = Promise.resolve();
  let stopped = false;
  const saveNow = (): Promise<void> => {
    if (stopped) return pending;
    pending = pending.then(() => saves.save(store.getState().save)).catch((e: unknown) => {
      console.error('Échec de la sauvegarde', e);
    });
    return pending;
  };

  setInterval(() => void saveNow(), BALANCE.time.autosaveIntervalMs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void saveNow();
  });
  window.addEventListener('pagehide', () => void saveNow());
  // Import d'une sauvegarde : plus rien ne doit écraser celle qu'on vient d'écrire.
  return {
    saveNow,
    stop: () => {
      stopped = true;
    },
  };
}
