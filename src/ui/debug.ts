import type { GameStore } from '../core/store';
import type { PuppyProbe } from '../input/gestures';
import type { DogId } from '../sim/state';

export interface DebugProbe {
  store: GameStore;
  dogId: DogId;
  latencies: number[];
  probe: PuppyProbe;
  fps: () => number;
}

declare global {
  interface Window {
    __truffe?: DebugProbe;
  }
}

/** Panneau de développement (?debug) : état du chiot et latence des réactions. */
export function mountDebug(d: DebugProbe): void {
  window.__truffe = d;
  const el = document.createElement('div');
  el.className = 'debug';
  el.dataset.testid = 'debug';
  document.body.appendChild(el);
  let last = '';
  const render = (): void => {
    const s = d.store.getState();
    const dog = s.save.dogs.find((x) => x.id === d.dogId);
    const m = s.minds[d.dogId];
    const lat = d.latencies.length ? Math.max(...d.latencies.slice(-10)).toFixed(0) : '–';
    const text = `Visite ${s.save.stats.sessions} · ${m?.mood ?? '?'} · ${m?.activity ?? '?'} · ${m?.posture ?? '?'} · ♥${dog?.affection ?? '?'} · ${lat} ms`;
    if (text === last) return;
    last = text;
    el.textContent = text;
    el.dataset.sessions = String(s.save.stats.sessions);
    el.dataset.mood = m?.mood ?? '';
    el.dataset.activity = m?.activity ?? '';
    el.dataset.posture = m?.posture ?? '';
  };
  render();
  d.store.subscribe(render);
}
