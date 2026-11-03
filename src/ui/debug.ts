import type { GameStore } from '../core/store';

/** Panneau de développement : prouve que la sauvegarde survit au rechargement. */
export function mountDebug(store: GameStore): void {
  const el = document.createElement('div');
  el.className = 'debug';
  el.dataset.testid = 'debug';
  const render = (): void => {
    const s = store.getState();
    el.textContent = `Visite n° ${s.stats.sessions}`;
    el.dataset.sessions = String(s.stats.sessions);
  };
  render();
  store.subscribe((_, a) => {
    if (a.type !== 'tick') render();
  });
  document.body.appendChild(el);
}
