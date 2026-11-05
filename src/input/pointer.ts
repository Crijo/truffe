import { capturePointer } from './capture';
import type { GestureRecognizer } from './gestures';

/** Gestionnaire prioritaire (jouet en main) : prend l'appui s'il le concerne. */
export interface PointerIntercept {
  down(x: number, y: number, t: number): boolean;
  move(x: number, y: number, t: number): void;
  up(x: number, y: number, t: number): void;
  cancel(): void;
  /**
   * D-89 : pendant un geste laissé aux gestes du chiot, le gestionnaire peut le reprendre
   * (glisser pour regarder ailleurs dans le salon) ; les gestes du chiot sont alors annulés.
   */
  steal?(x: number, y: number, t: number): boolean;
}

/** Relie les pointer events du canevas (doigt, souris, stylet) aux gestes et aux jouets. */
export function bindPointer(el: HTMLElement, recognizer: () => GestureRecognizer | null, onInput: (t: number) => void, intercept?: PointerIntercept): void {
  let active: number | null = null;
  let toAux = false;
  const pos = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const kind = (e: PointerEvent) => (e.pointerType === 'mouse' || e.pointerType === 'pen' ? e.pointerType : 'touch');

  el.addEventListener('pointerdown', (e) => {
    if (active !== null) return;
    active = e.pointerId;
    capturePointer(el, e.pointerId);
    const p = pos(e);
    onInput(e.timeStamp);
    toAux = intercept?.down(p.x, p.y, e.timeStamp) ?? false;
    if (!toAux) recognizer()?.down(p.x, p.y, e.timeStamp, kind(e));
  });
  el.addEventListener('pointermove', (e) => {
    const p = pos(e);
    if (active === e.pointerId) {
      onInput(e.timeStamp);
      if (!toAux && intercept?.steal?.(p.x, p.y, e.timeStamp)) {
        recognizer()?.cancel();
        toAux = true;
      }
      if (toAux) intercept?.move(p.x, p.y, e.timeStamp);
      else recognizer()?.move(p.x, p.y, e.timeStamp);
    } else if (active === null && e.pointerType === 'mouse') {
      recognizer()?.hover(p.x, p.y, e.timeStamp);
    }
  });
  const end = (e: PointerEvent) => {
    if (active !== e.pointerId) return;
    active = null;
    const p = pos(e);
    onInput(e.timeStamp);
    if (toAux) intercept?.up(p.x, p.y, e.timeStamp);
    else recognizer()?.up(p.x, p.y, e.timeStamp);
    toAux = false;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', (e) => {
    if (active !== e.pointerId) return;
    active = null;
    if (toAux) intercept?.cancel();
    else recognizer()?.cancel();
    toAux = false;
  });
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && active === null) recognizer()?.leave();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
