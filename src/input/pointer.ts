import type { GestureRecognizer } from './gestures';

/** Relie les pointer events du canevas (doigt, souris, stylet) au reconnaisseur de gestes. */
export function bindPointer(el: HTMLElement, rec: GestureRecognizer, onInput: (t: number) => void): void {
  let active: number | null = null;
  const pos = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const kind = (e: PointerEvent) => (e.pointerType === 'mouse' || e.pointerType === 'pen' ? e.pointerType : 'touch');

  el.addEventListener('pointerdown', (e) => {
    if (active !== null) return;
    active = e.pointerId;
    el.setPointerCapture(e.pointerId);
    const p = pos(e);
    onInput(e.timeStamp);
    rec.down(p.x, p.y, e.timeStamp, kind(e));
  });
  el.addEventListener('pointermove', (e) => {
    const p = pos(e);
    if (active === e.pointerId) {
      onInput(e.timeStamp);
      rec.move(p.x, p.y, e.timeStamp);
    } else if (active === null && e.pointerType === 'mouse') {
      rec.hover(p.x, p.y, e.timeStamp);
    }
  });
  const end = (e: PointerEvent) => {
    if (active !== e.pointerId) return;
    active = null;
    const p = pos(e);
    onInput(e.timeStamp);
    rec.up(p.x, p.y, e.timeStamp);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', (e) => {
    if (active !== e.pointerId) return;
    active = null;
    rec.cancel();
  });
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && active === null) rec.leave();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
