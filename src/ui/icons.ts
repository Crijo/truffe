/** Icônes dessinées pour Truffe (SVG en ligne, voir ASSETS.md). */

const svg = (body: string): string =>
  `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  bag: svg('<path d="M10 18h28l-3 22H13z"/><path d="M17 18v-4a7 7 0 0 1 14 0v4"/>'),
  out: svg('<path d="M14 42V8h20v34"/><path d="M8 42h32"/><circle cx="29" cy="26" r="1.8" fill="currentColor"/>'),
  mic: svg('<rect x="18" y="6" width="12" height="22" rx="6"/><path d="M11 22a13 13 0 0 0 26 0M24 35v7M17 42h14"/>'),
  settings: svg('<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11.3 11.3l4.2 4.2M32.5 32.5l4.2 4.2M11.3 36.7l4.2-4.2M32.5 15.5l4.2-4.2"/><circle cx="24" cy="24" r="12"/>'),
  hand: svg('<path d="M16 26V12a3 3 0 0 1 6 0v10M22 22V9a3 3 0 0 1 6 0v13M28 22V11a3 3 0 0 1 6 0v14M34 25v-6a3 3 0 0 1 6 0v9c0 8-6 14-14 14h-2c-5 0-8-2-11-6l-5-7a3 3 0 0 1 5-4l3 4" fill="#fbe3cf"/>'),
  card: svg('<rect x="10" y="7" width="28" height="34" rx="4"/><path d="M17 18h14M17 25h14M17 32h8"/><circle cx="35" cy="37" r="1" fill="currentColor"/>'),
  food: svg('<path d="M6 26h36l-5 12H11z"/><circle cx="17" cy="22" r="3"/><circle cx="24" cy="20" r="3"/><circle cx="31" cy="22" r="3"/>'),
  water: svg('<path d="M6 28h36l-5 11H11z"/><path d="M24 7c4 6 7 10 7 13a7 7 0 0 1-14 0c0-3 3-7 7-13z"/>'),
  brush: svg('<rect x="8" y="10" width="26" height="10" rx="4"/><path d="M12 20v6M17 20v6M22 20v6M27 20v6M32 20v6"/><path d="M34 15h6v22"/>'),
  bath: svg('<path d="M6 24h36v4a10 10 0 0 1-10 10H16A10 10 0 0 1 6 28z"/><path d="M12 24V12a5 5 0 0 1 9-3"/><path d="M14 38l-2 4M34 38l2 4"/>'),
  soap: svg('<rect x="9" y="20" width="28" height="18" rx="6"/><circle cx="20" cy="12" r="4"/><circle cx="31" cy="9" r="3"/><circle cx="36" cy="16" r="2"/>'),
  shower: svg('<path d="M10 10h14a8 8 0 0 1 8 8v2"/><path d="M24 20h16"/><path d="M27 27l-2 4M33 27v5M39 27l2 4"/>'),
  dryer: svg('<path d="M8 14h20a8 8 0 0 1 0 16H8z"/><path d="M16 30l-3 12h7l3-12"/><path d="M36 18h6M37 24h6M36 30h6"/>'),
  close: svg('<path d="M14 14l20 20M34 14L14 34"/>'),
  done: svg('<path d="M10 25l9 9 19-20"/>'),
  hunger: svg('<path d="M8 26h32l-4 12H12z"/><path d="M16 22c0-4 4-8 8-8s8 4 8 8"/>'),
  thirst: svg('<path d="M24 6c6 9 11 15 11 21a11 11 0 0 1-22 0c0-6 5-12 11-21z"/>'),
  coat: svg('<circle cx="18" cy="28" r="10"/><circle cx="33" cy="17" r="7"/><circle cx="35" cy="34" r="4.5"/><path d="M13 24a6 6 0 0 1 5-4"/>'),
  moon: svg('<path d="M30 8a16 16 0 1 0 10 26A13 13 0 0 1 30 8z"/>'),
  ball: svg('<circle cx="24" cy="24" r="15"/><path d="M11 20c8 5 18 5 26 0"/>'),
  disc: svg('<ellipse cx="24" cy="26" rx="18" ry="8"/><ellipse cx="24" cy="24" rx="10" ry="4"/>'),
  rope: svg('<path d="M8 32c6-12 12 4 18-8s10 4 14-6"/><circle cx="8" cy="32" r="3.5"/><circle cx="40" cy="18" r="3.5"/>'),
  coin: svg('<circle cx="24" cy="24" r="15"/><path d="M24 16v16M19 20h8a3 3 0 0 1 0 6h-6a3 3 0 0 0 0 6h8"/>'),
  map: svg('<path d="M8 12l10-4 12 4 10-4v28l-10 4-12-4-10 4z"/><path d="M18 8v28M30 12v28"/>'),
  tag: svg('<path d="M8 24 24 8h14v14L22 38z"/><circle cx="31" cy="15" r="2.5"/>'),
  lock: svg('<rect x="12" y="22" width="24" height="18" rx="3"/><path d="M17 22v-6a7 7 0 0 1 14 0v6"/>'),
  star: svg('<path d="M24 8l4.6 10 10.4 1-7.8 7 2.3 10.5L24 31l-9.5 5.5L16.8 26 9 19l10.4-1z"/>'),
  steps: svg('<ellipse cx="17" cy="16" rx="5" ry="7"/><ellipse cx="31" cy="30" rx="5" ry="7"/><path d="M14 27h6M28 41h6"/>'),
  book: svg('<path d="M10 10h12a4 4 0 0 1 4 4v24a3 3 0 0 0-3-3H10zM38 10H28a4 4 0 0 0-4 4"/><path d="M38 10v25H27"/>'),
  home: svg('<path d="M8 24 24 10l16 14M12 21v17h24V21"/><path d="M21 38V28h6v10"/>'),
  trophy: svg('<path d="M15 8h18v8a9 9 0 0 1-18 0z"/><path d="M15 11H9a6 6 0 0 0 6 8M33 11h6a6 6 0 0 1-6 8M24 25v8M17 40h14M19 33h10v7H19z"/>'),
  you: svg('<circle cx="24" cy="16" r="8"/><path d="M9 41c1-9 7-14 15-14s14 5 15 14"/>'),
  basket: svg('<path d="M6 20h36l-4 20H10z"/><path d="M14 20l6-12M34 20l-6-12"/><path d="M9 28h30M11 34h26M18 20v20M24 20v20M30 20v20"/>'),
  sponge: svg('<rect x="8" y="16" width="32" height="20" rx="6"/><circle cx="17" cy="24" r="2"/><circle cx="27" cy="28" r="2.5"/><circle cx="32" cy="22" r="1.5"/><path d="M12 12c2-3 5-3 7 0M30 10c2-3 5-3 7 0"/>'),
  paw: svg('<ellipse cx="24" cy="31" rx="9" ry="7"/><circle cx="13" cy="20" r="3.5"/><circle cx="20" cy="13" r="3.5"/><circle cx="28" cy="13" r="3.5"/><circle cx="35" cy="20" r="3.5"/>'),
} as const;

export type IconName = keyof typeof ICONS;
