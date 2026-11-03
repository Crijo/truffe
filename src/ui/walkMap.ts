/** Plan de ville (F-PRO-1, F-PRO-2, F-PRO-4) : tracer le trajet au doigt. */
import { CITY, CITY_BY_ID, CITY_COLS, CITY_ROWS, HOME_NODE, PLACE_LABELS, type PlaceId } from '../data/city';
import { WALK } from '../data/strings';
import type { QuestionPoint, Route } from '../sim/walk';
import { ICONS } from './icons';
import { panel } from './outings';

export interface MapHandlers {
  stamina(): number;
  maxMeters(): number;
  questions(): QuestionPoint[];
  /** Minutes avant la prochaine promenade avec gains (0 : tout de suite). */
  waitMinutes(): number;
  extend(route: Route, node: string): Route;
  meters(route: Route): number;
  start(route: Route): void;
}

const CELL = 100;
const pos = (id: string) => {
  const n = CITY_BY_ID[id];
  return { x: (n?.col ?? 0) * CELL + CELL / 2, y: (n?.row ?? 0) * CELL + CELL / 2 };
};

const PLACE_ART: Record<PlaceId, string> = {
  home: '<path d="M-16 4 0-12 16 4v14h-32z" fill="#e8b37a" stroke="#4a2f1f" stroke-width="3"/><rect x="-5" y="6" width="10" height="12" fill="#9c6436"/>',
  park: '<circle cx="-8" cy="-2" r="11" fill="#7cc47f" stroke="#3e7c46" stroke-width="3"/><circle cx="9" cy="2" r="9" fill="#9bd39b" stroke="#3e7c46" stroke-width="3"/><rect x="-10" y="8" width="4" height="10" fill="#8a5a2e"/>',
  gym: '<rect x="-18" y="-10" width="36" height="26" rx="3" fill="#b9d7ee" stroke="#2f5d9a" stroke-width="3"/><path d="M-10 3h20M-12-1v8M12-1v8" stroke="#2f5d9a" stroke-width="3"/>',
  market: '<path d="M-18-6h36l-4 8h-28z" fill="#e8564a" stroke="#4a2f1f" stroke-width="3"/><rect x="-14" y="2" width="28" height="14" fill="#fbf4e9" stroke="#4a2f1f" stroke-width="3"/>',
};

export function openMap(h: MapHandlers, onClose: () => void): void {
  const p = panel(WALK.mapTitle, null, onClose);
  p.root.classList.add('map-panel');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${CITY_COLS * CELL} ${CITY_ROWS * CELL}`);
  svg.classList.add('city');
  svg.dataset.testid = 'city';
  let streets = '';
  for (const n of CITY) {
    const a = pos(n.id);
    if (n.col < CITY_COLS - 1) streets += `<line x1="${a.x}" y1="${a.y}" x2="${a.x + CELL}" y2="${a.y}"/>`;
    if (n.row < CITY_ROWS - 1) streets += `<line x1="${a.x}" y1="${a.y}" x2="${a.x}" y2="${a.y + CELL}"/>`;
  }
  let places = '';
  for (const n of CITY.filter((c) => c.place)) {
    const a = pos(n.id);
    places += `<g transform="translate(${a.x} ${a.y})">${PLACE_ART[n.place ?? 'home']}<text y="38" text-anchor="middle">${PLACE_LABELS[n.place ?? 'home']}</text></g>`;
  }
  let marks = '';
  for (const q of h.questions()) {
    const a = pos(q.nodeId);
    marks += `<g transform="translate(${a.x} ${a.y})" class="question"><circle r="15"/><text y="7" text-anchor="middle">?</text></g>`;
  }
  svg.innerHTML = `<rect width="100%" height="100%" class="blocks"/><g class="streets">${streets}</g><polyline class="route" points=""/><g>${marks}</g><g class="places">${places}</g><circle class="walker" r="11"/>`;

  const info = document.createElement('p');
  info.className = 'hint';
  info.setAttribute('role', 'status');
  const meter = document.createElement('div');
  meter.className = 'meter';
  meter.dataset.testid = 'route-meter';
  const row = document.createElement('div');
  row.className = 'row-buttons';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'btn';
  clear.innerHTML = `${ICONS.close}<span>${WALK.clear}</span>`;
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'btn primary';
  go.dataset.testid = 'walk-go';
  go.innerHTML = `${ICONS.paw}<span>${WALK.go}</span>`;
  row.append(clear, go);
  const wait = h.waitMinutes();
  info.textContent = wait > 0 ? WALK.noGains.replace('{min}', String(wait)) : WALK.mapHint;
  p.body.append(info, svg, meter, row);

  let route: Route = [HOME_NODE];
  const draw = (): void => {
    const pts = route.map((id) => pos(id)).map((a) => `${a.x},${a.y}`).join(' ');
    svg.querySelector('.route')?.setAttribute('points', pts);
    const end = pos(route.at(-1) ?? HOME_NODE);
    const walker = svg.querySelector('.walker');
    walker?.setAttribute('cx', String(end.x));
    walker?.setAttribute('cy', String(end.y));
    const m = h.meters(route);
    const max = h.maxMeters();
    meter.innerHTML = `<span>${WALK.distance} : ${m} m / ${max} m</span><span class="progress"><span style="width:${Math.min(100, (m / max) * 100)}%"></span></span>`;
    go.disabled = route.length < 2;
  };
  const toLocal = (e: PointerEvent): { x: number; y: number } => {
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CITY_COLS * CELL, y: ((e.clientY - r.top) / r.height) * CITY_ROWS * CELL };
  };
  const nearest = (q: { x: number; y: number }): string | null => {
    let best: string | null = null;
    let d = 42;
    for (const n of CITY) {
      const a = pos(n.id);
      const dd = Math.hypot(a.x - q.x, a.y - q.y);
      if (dd < d) {
        d = dd;
        best = n.id;
      }
    }
    return best;
  };
  let drawing = false;
  svg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    drawing = true;
    const n = nearest(toLocal(e));
    if (n === HOME_NODE && route.length > 1) route = [HOME_NODE];
    else if (n && n !== route.at(-1)) route = h.extend(route, n);
    draw();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const n = nearest(toLocal(e));
    if (n && n !== route.at(-1)) {
      route = h.extend(route, n);
      draw();
    }
  });
  const stop = (): void => {
    drawing = false;
  };
  svg.addEventListener('pointerup', stop);
  svg.addEventListener('pointercancel', stop);
  clear.addEventListener('click', () => {
    route = [HOME_NODE];
    draw();
  });
  go.addEventListener('click', () => {
    if (route.length < 2) return;
    p.root.remove();
    h.start(route);
  });
  draw();
}
