/** Icônes des objets, dessinées pour Truffe (SVG), et leur silhouette pour le carnet. */
import type { ItemDef, ItemShape } from '../data/items';

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Corps du dessin : `a` est la couleur principale, `b` la seconde. */
const SHAPES: Record<ItemShape, (a: string, b: string) => string> = {
  can: (a, b) => `<rect x="12" y="12" width="24" height="26" rx="4" fill="${a}"/><rect x="12" y="20" width="24" height="10" fill="${b}"/><ellipse cx="24" cy="12" rx="12" ry="3" fill="${b}"/>`,
  biscuit: (a, b) => `<path d="M10 22a6 6 0 0 1 6-10h16a6 6 0 0 1 6 10 6 6 0 0 1-6 10H16a6 6 0 0 1-6-10z" fill="${a}"/><circle cx="19" cy="22" r="1.6" fill="${b}"/><circle cx="25" cy="20" r="1.6" fill="${b}"/><circle cx="30" cy="24" r="1.6" fill="${b}"/>`,
  bone: (a, b) => `<path d="M14 18a4 4 0 1 1 4-6l12 0a4 4 0 1 1 4 6 4 4 0 1 1-4 6H18a4 4 0 1 1-4-6z" fill="${a}" stroke="${b}" stroke-width="2"/>`,
  bottle: (a, b) => `<rect x="17" y="16" width="14" height="22" rx="4" fill="${a}" stroke="${b}" stroke-width="2"/><rect x="20" y="9" width="8" height="7" rx="2" fill="${b}"/>`,
  cheese: (a, b) => `<path d="M8 32 38 16v16z" fill="${a}"/><circle cx="26" cy="27" r="2.5" fill="${b}"/><circle cx="33" cy="24" r="1.8" fill="${b}"/>`,
  ball: (a, b) => `<circle cx="24" cy="24" r="14" fill="${a}"/><circle cx="18" cy="20" r="3" fill="${b}"/><circle cx="28" cy="18" r="2.5" fill="${b}"/><circle cx="27" cy="29" r="3" fill="${b}"/>`,
  disc: (a, b) => `<ellipse cx="24" cy="26" rx="17" ry="8" fill="${a}"/><ellipse cx="24" cy="24" rx="9" ry="4" fill="${b}"/>`,
  ring: (a, b) => `<circle cx="24" cy="24" r="13" fill="none" stroke="${a}" stroke-width="7"/><circle cx="24" cy="24" r="13" fill="none" stroke="${b}" stroke-width="1.5"/>`,
  rope: (a, b) => `<path d="M10 30c6-12 12 4 18-8s8 2 10-4" fill="none" stroke="${a}" stroke-width="6" stroke-linecap="round"/><circle cx="10" cy="30" r="4" fill="${b}"/><circle cx="38" cy="18" r="4" fill="${b}"/>`,
  collar: (a, b) => `<ellipse cx="24" cy="24" rx="15" ry="9" fill="none" stroke="${a}" stroke-width="6"/><circle cx="24" cy="34" r="4" fill="${b}"/>`,
  bandana: (a, b) => `<path d="M8 16h32L24 38z" fill="${a}"/><path d="M14 20h20M18 26h12" stroke="${b}" stroke-width="2"/>`,
  hat: (a, b) => `<path d="M12 32c0-14 24-14 24 0z" fill="${a}"/><rect x="10" y="30" width="28" height="6" rx="3" fill="${b}"/><circle cx="24" cy="15" r="4" fill="${b}"/>`,
  strawhat: (a, b) => `<ellipse cx="24" cy="30" rx="18" ry="5" fill="${a}"/><path d="M15 29c0-12 18-12 18 0z" fill="${a}"/><rect x="15" y="24" width="18" height="4" fill="${b}"/>`,
  bow: (a, b) => `<path d="M24 24 10 14v20zM24 24l14-10v20z" fill="${a}"/><circle cx="24" cy="24" r="4" fill="${b}"/>`,
  glasses: (a, b) => `<circle cx="16" cy="24" r="7" fill="${b}" stroke="${a}" stroke-width="3"/><circle cx="32" cy="24" r="7" fill="${b}" stroke="${a}" stroke-width="3"/><path d="M23 23h2" stroke="${a}" stroke-width="3"/>`,
  crown: (a, b) => `<path d="M10 28c4-6 24-6 28 0" fill="none" stroke="${b}" stroke-width="4"/><circle cx="14" cy="24" r="4" fill="${a}"/><circle cx="24" cy="21" r="4.5" fill="${a}"/><circle cx="34" cy="24" r="4" fill="${a}"/>`,
  shampoo: (a, b) => `<rect x="15" y="16" width="18" height="22" rx="5" fill="${a}"/><rect x="21" y="9" width="6" height="7" fill="${b}"/><rect x="18" y="24" width="12" height="6" rx="2" fill="${b}"/>`,
  brush: (a, b) => `<rect x="10" y="16" width="20" height="9" rx="4" fill="${a}"/><path d="M13 25v5M17 25v5M21 25v5M25 25v5" stroke="${b}" stroke-width="2"/><path d="M30 20h9" stroke="${a}" stroke-width="5" stroke-linecap="round"/>`,
  spray: (a, b) => `<rect x="16" y="18" width="16" height="20" rx="4" fill="${a}"/><rect x="20" y="12" width="8" height="6" fill="${b}"/><circle cx="35" cy="12" r="1.5" fill="${a}"/><circle cx="38" cy="16" r="1.5" fill="${a}"/>`,
  cone: (a, b) => `<ellipse cx="24" cy="25" rx="10" ry="14" fill="${a}"/><path d="M16 18h16M15 25h18M16 32h16" stroke="${b}" stroke-width="2"/>`,
  shell: (a, b) => `<path d="M24 10 8 34h32z" fill="${a}"/><path d="M24 12v22M18 18l-4 16M30 18l4 16" stroke="${b}" stroke-width="2"/>`,
  feather: (a, b) => `<path d="M34 10C18 14 12 26 14 38c10-2 20-12 20-28z" fill="${a}"/><path d="M14 38 32 14" stroke="${b}" stroke-width="2"/>`,
  stone: (a, b) => `<path d="M10 30c0-10 8-16 16-16s12 8 12 14-6 8-14 8-14 0-14-6z" fill="${a}"/><circle cx="20" cy="22" r="2.5" fill="${b}"/>`,
  key: (a, b) => `<circle cx="16" cy="24" r="7" fill="none" stroke="${a}" stroke-width="4"/><path d="M23 24h16M34 24v5M38 24v4" stroke="${a}" stroke-width="4"/><circle cx="16" cy="24" r="2" fill="${b}"/>`,
  button: (a, b) => `<circle cx="24" cy="24" r="13" fill="${a}" stroke="${b}" stroke-width="2"/><circle cx="20" cy="20" r="2" fill="${b}"/><circle cx="28" cy="20" r="2" fill="${b}"/><circle cx="20" cy="28" r="2" fill="${b}"/><circle cx="28" cy="28" r="2" fill="${b}"/>`,
  leaf: (a, b) => `<path d="M24 8 30 18 38 16 34 24 40 28 30 30 28 38 24 32 20 38 18 30 8 28 14 24 10 16 18 18z" fill="${a}"/><path d="M24 14v26" stroke="${b}" stroke-width="2"/>`,
  acorn: (a, b) => `<ellipse cx="24" cy="28" rx="9" ry="11" fill="${a}"/><path d="M13 22c0-8 22-8 22 0z" fill="${b}"/><path d="M24 12v4" stroke="${b}" stroke-width="3"/>`,
  marble: (a, b) => `<circle cx="24" cy="24" r="12" fill="${a}"/><path d="M16 26c4-6 10 2 16-4" stroke="${b}" stroke-width="2.5" fill="none"/><circle cx="20" cy="19" r="2.5" fill="${b}"/>`,
  bell: (a, b) => `<path d="M14 32c0-12 4-18 10-18s10 6 10 18z" fill="${a}"/><rect x="11" y="31" width="26" height="4" rx="2" fill="${b}"/><circle cx="24" cy="38" r="3" fill="${b}"/>`,
  card: (a, b) => `<rect x="8" y="13" width="32" height="22" rx="2" fill="${a}" stroke="${b}" stroke-width="2"/><rect x="30" y="16" width="7" height="8" fill="${b}"/><path d="M12 22h14M12 27h14" stroke="${b}" stroke-width="2"/>`,
  star: (a, b) => `<path d="M24 8 28 19 40 19 30 26 34 38 24 31 14 38 18 26 8 19 20 19z" fill="${a}" stroke="${b}" stroke-width="2" stroke-linejoin="round"/>`,
  flower: (a, b) => `<g fill="${a}"><circle cx="24" cy="14" r="6"/><circle cx="34" cy="22" r="6"/><circle cx="30" cy="33" r="6"/><circle cx="18" cy="33" r="6"/><circle cx="14" cy="22" r="6"/></g><circle cx="24" cy="25" r="5" fill="${b}"/>`,
};

/** Icône en couleurs, ou silhouette sombre pour un objet pas encore découvert (F-ECO-4). */
export function itemIcon(def: ItemDef, silhouette = false): string {
  const [a, b] = silhouette ? ['#5a4a3e', '#5a4a3e'] : [hex(def.colors[0]), hex(def.colors[1])];
  return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${SHAPES[def.shape](a, b)}</svg>`;
}
