/**
 * Capture du pointeur, sans risque : certains navigateurs (WebKit en particulier)
 * refusent la capture d'un appui tactile et lèvent une exception, qui couperait le geste.
 */
export function capturePointer(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Sans capture, le geste marche quand même tant que le doigt reste sur l'élément.
  }
}
