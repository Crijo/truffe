/**
 * D-79 : carré où l'on retrace du doigt le dessin d'un ordre. Le dessin est en pointillés ;
 * le trait du joueur s'affiche par-dessus, et sa précision est calculée au lever du doigt.
 */
import { BALANCE } from '../data/balance';
import { TRACE_SHAPES, type Pt } from '../data/traceShapes';
import type { TrickId } from '../data/tricks';
import { capturePointer } from '../input/capture';
import { traceScore } from '../sim/trace';

const NS = 'http://www.w3.org/2000/svg';
const toPath = (pts: readonly Pt[]): string => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * 100).toFixed(1)} ${(p.y * 100).toFixed(1)}`).join(' ');

export interface TracePad {
  root: HTMLElement;
  /** Dessin à retracer ; null : carré vide. */
  show(trick: TrickId | null): void;
}

/** `done(score)` : tracé terminé, assez précis ou non (comparer à BALANCE.trace.minScore). */
export function createTracePad(label: string, done: (trick: TrickId, score: number) => void): TracePad {
  const root = document.createElement('div');
  root.className = 'trace-pad idle';
  root.dataset.testid = 'trace-pad';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', label);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  const guide = document.createElementNS(NS, 'path');
  guide.setAttribute('class', 'trace-guide');
  const start = document.createElementNS(NS, 'circle');
  start.setAttribute('class', 'trace-start');
  start.setAttribute('r', '4');
  const ink = document.createElementNS(NS, 'path');
  ink.setAttribute('class', 'trace-ink');
  svg.append(guide, start, ink);
  root.append(svg);

  let trick: TrickId | null = null;
  let drawn: Pt[] = [];
  let drawing = false;
  const at = (e: PointerEvent): Pt => {
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) };
  };
  root.addEventListener('pointerdown', (e) => {
    if (!trick) return;
    e.preventDefault();
    capturePointer(root, e.pointerId);
    drawing = true;
    drawn = [at(e)];
    ink.setAttribute('d', toPath(drawn));
  });
  root.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    drawn.push(at(e));
    ink.setAttribute('d', toPath(drawn));
  });
  const up = (): void => {
    if (!drawing || !trick) return;
    drawing = false;
    const score = traceScore(TRACE_SHAPES[trick], drawn);
    root.classList.toggle('good', score >= BALANCE.trace.minScore);
    done(trick, score);
    window.setTimeout(() => {
      ink.setAttribute('d', '');
      root.classList.remove('good');
    }, 350);
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);

  return {
    root,
    show(t) {
      if (t === trick) return;
      trick = t;
      drawn = [];
      ink.setAttribute('d', '');
      const shape = t ? TRACE_SHAPES[t] : [];
      guide.setAttribute('d', shape.length ? toPath(shape) : '');
      const first = shape[0];
      start.setAttribute('cx', String((first?.x ?? -1) * 100));
      start.setAttribute('cy', String((first?.y ?? -1) * 100));
      root.classList.toggle('idle', t === null);
    },
  };
}
