import type { GameStore } from '../core/store';
import type { PuppyProbe } from '../input/gestures';
import type { DogId } from '../sim/state';

export interface DebugProbe {
  store: GameStore;
  dogId: DogId;
  latencies: number[];
  probe: PuppyProbe;
  fps: () => number;
  rewind: (ms: number) => void;
  bulb: () => { x: number; y: number; r: number } | null;
  /** Concours en cours : mètres du terrain → écran (tests au doigt). */
  /** Besoins au salon, à l’écran (tests). */
  poopsOnScreen?: (() => { id: string; x: number; y: number }[]) | undefined;
  /** D-83 : décalage de la caméra du salon (pixels). */
  camera?: (() => number) | undefined;
  /** D-89 : repères des chiots hors de la vue. */
  edges?: (() => { id: string; x: number; y: number }[]) | undefined;
  fieldToScreen?: ((p: { x: number; y: number }) => { x: number; y: number }) | undefined;
}

declare global {
  interface Window {
    __truffe?: DebugProbe;
  }
}

/** Panneau de développement (?debug) : état du chiot et latence des réactions. */
/** Simule une absence : recule la dernière visite, puis le joueur revient maintenant. */
export function rewind(store: GameStore, ms: number): void {
  const s = store.getState();
  store.replaceForDebug({ ...s, save: { ...s.save, lastSeenAt: s.save.lastSeenAt - ms } });
  const now = Math.max(Date.now(), s.save.lastSeenAt);
  store.dispatch({ type: 'session/resume', now, tzOffsetMin: new Date(now).getTimezoneOffset() });
}

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
