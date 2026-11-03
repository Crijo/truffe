/** Icônes dessinées pour Truffe (SVG en ligne, voir ASSETS.md). */

const svg = (body: string): string =>
  `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  bag: svg('<path d="M10 18h28l-3 22H13z"/><path d="M17 18v-4a7 7 0 0 1 14 0v4"/>'),
  out: svg('<path d="M14 42V8h20v34"/><path d="M8 42h32"/><circle cx="29" cy="26" r="1.8" fill="currentColor"/>'),
  mic: svg('<rect x="18" y="6" width="12" height="22" rx="6"/><path d="M11 22a13 13 0 0 0 26 0M24 35v7M17 42h14"/>'),
  card: svg('<rect x="10" y="7" width="28" height="34" rx="4"/><path d="M17 18h14M17 25h14M17 32h8"/><circle cx="35" cy="37" r="1" fill="currentColor"/>'),
  food: svg('<path d="M6 26h36l-5 12H11z"/><circle cx="17" cy="22" r="3"/><circle cx="24" cy="20" r="3"/><circle cx="31" cy="22" r="3"/>'),
  water: svg('<path d="M6 28h36l-5 11H11z"/><path d="M24 7c4 6 7 10 7 13a7 7 0 0 1-14 0c0-3 3-7 7-13z"/>'),
  brush: svg('<rect x="8" y="10" width="26" height="10" rx="4"/><path d="M12 20v6M17 20v6M22 20v6M27 20v6M32 20v6"/><path d="M34 15h6v22"/>'),
  bath: svg('<path d="M6 24h36v4a10 10 0 0 1-10 10H16A10 10 0 0 1 6 28z"/><path d="M12 24V12a5 5 0 0 1 9-3"/><path d="M14 38l-2 4M34 38l2 4"/>'),
  soap: svg('<rect x="9" y="20" width="28" height="18" rx="6"/><circle cx="20" cy="12" r="4"/><circle cx="31" cy="9" r="3"/><circle cx="36" cy="16" r="2"/>'),
  shower: svg('<path d="M10 10h14a8 8 0 0 1 8 8v2"/><path d="M24 20h16"/><path d="M27 27l-2 4M33 27v5M39 27l2 4"/>'),
  towel: svg('<path d="M10 10h28v28H10z"/><path d="M10 30h28M16 34h16"/>'),
  close: svg('<path d="M14 14l20 20M34 14L14 34"/>'),
  done: svg('<path d="M10 25l9 9 19-20"/>'),
  hunger: svg('<path d="M8 26h32l-4 12H12z"/><path d="M16 22c0-4 4-8 8-8s8 4 8 8"/>'),
  thirst: svg('<path d="M24 6c6 9 11 15 11 21a11 11 0 0 1-22 0c0-6 5-12 11-21z"/>'),
  coat: svg('<path d="M24 8l3 9h9l-7 6 3 9-8-6-8 6 3-9-7-6h9z"/>'),
  moon: svg('<path d="M30 8a16 16 0 1 0 10 26A13 13 0 0 1 30 8z"/>'),
  ball: svg('<circle cx="24" cy="24" r="15"/><path d="M11 20c8 5 18 5 26 0"/>'),
  disc: svg('<ellipse cx="24" cy="26" rx="18" ry="8"/><ellipse cx="24" cy="24" rx="10" ry="4"/>'),
  rope: svg('<path d="M8 32c6-12 12 4 18-8s10 4 14-6"/><circle cx="8" cy="32" r="3.5"/><circle cx="40" cy="18" r="3.5"/>'),
  paw: svg('<ellipse cx="24" cy="31" rx="9" ry="7"/><circle cx="13" cy="20" r="3.5"/><circle cx="20" cy="13" r="3.5"/><circle cx="28" cy="13" r="3.5"/><circle cx="35" cy="20" r="3.5"/>'),
} as const;

export type IconName = keyof typeof ICONS;
