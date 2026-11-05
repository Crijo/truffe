/** Interface pendant la promenade : avancée, ramasser, lieux, bilan. */
import { CITY, CITY_BY_ID, CITY_COLS, CITY_ROWS, PLACE_LABELS } from '../data/city';
import { BALANCE } from '../data/balance';
import { ITEM_BY_ID } from '../data/items';
import { WALK } from '../data/strings';
import type { WalkState } from '../sim/walk';
import { ICONS } from './icons';
import { itemIcon } from './itemIcon';

export interface WalkHudHandlers {
  finish(): void;
  pickup(): void;
  enter(): void;
  continue(): void;
  close(): void;
  /** Gains montrés dans le bilan. */
  gains(w: WalkState): { points: number; stamina: number; stepPoints: number } | null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

export function mountWalkHud(h: WalkHudHandlers): { update(w: WalkState): void; destroy(): void } {
  const root = el('div', 'walk-hud');
  root.dataset.testid = 'walk-hud';
  const top = el('div', 'walk-top');
  const bar = el('span', 'progress');
  const fill = el('span', '');
  bar.append(fill);
  const home = el('button', 'btn', `${ICONS.home}<span>${WALK.home}</span>`);
  home.type = 'button';
  home.dataset.testid = 'walk-home';
  home.addEventListener('click', () => h.finish());
  const steps = el('span', 'walk-steps');
  steps.dataset.testid = 'walk-steps';
  steps.hidden = true;
  top.append(bar, steps, home);
  const hint = el('p', 'toast walk-hint', WALK.leashHint);
  const action = el('div', 'walk-action');
  const summary = el('section', 'name-box walk-summary');
  summary.hidden = true;
  summary.dataset.testid = 'walk-summary';
  // D-92 : petit plan du trajet, avec le chiot qui avance et tourne aux carrefours.
  const mini = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mini.setAttribute('viewBox', `0 0 ${CITY_COLS * 20} ${CITY_ROWS * 20}`);
  mini.classList.add('walk-mini');
  mini.dataset.testid = 'walk-mini';
  mini.setAttribute('aria-hidden', 'true');
  const at = (id: string): { x: number; y: number } => {
    const n = CITY_BY_ID[id];
    return { x: (n?.col ?? 0) * 20 + 10, y: (n?.row ?? 0) * 20 + 10 };
  };
  let grid = '';
  for (const n of CITY) {
    const a = at(n.id);
    if (n.col < CITY_COLS - 1) grid += `M${a.x} ${a.y}h20`;
    if (n.row < CITY_ROWS - 1) grid += `M${a.x} ${a.y}v20`;
  }
  mini.innerHTML = `<rect width="100%" height="100%" rx="10" class="mini-bg"/><path d="${grid}" class="mini-grid"/><polyline class="mini-route" points=""/>`;
  const routeLine = mini.querySelector('polyline');
  // Le point du chiot est un élément à part, déplacé par une transformation : le plan n'est pas repeint à chaque image.
  const miniBox = el('div', 'walk-mini-box');
  const dot = el('span', 'mini-dog');
  miniBox.append(mini, dot);
  let routeKey = '';
  let dotKey = '';
  root.append(top, miniBox, hint, action, summary);
  document.body.append(root);
  window.setTimeout(() => hint.remove(), 4000);

  let lastKey = '';
  const update = (w: WalkState): void => {
    const rk = w.plan.route.join();
    if (rk !== routeKey) {
      routeKey = rk;
      routeLine?.setAttribute('points', w.plan.route.map((id) => { const p = at(id); return `${p.x},${p.y}`; }).join(' '));
    }
    const E = BALANCE.walk.edgeM;
    const k = Math.min(w.plan.route.length - 2, Math.floor(w.progress / E));
    const a = at(w.plan.route[Math.max(0, k)] ?? '');
    const b = at(w.plan.route[Math.max(0, k) + 1] ?? w.plan.route[Math.max(0, k)] ?? '');
    const u = Math.min(1, Math.max(0, w.progress / E - Math.max(0, k)));
    // Plan de 96 px pour 120 unités.
    const k96 = 96 / (CITY_COLS * 20);
    const dx = Math.round((a.x + (b.x - a.x) * u) * k96 * 2) / 2;
    const dy = Math.round((a.y + (b.y - a.y) * u) * k96 * 2) / 2;
    const dk = `${dx},${dy}`;
    if (dk !== dotKey) {
      dotKey = dk;
      dot.style.transform = `translate(${dx - 5}px, ${dy - 5}px)`;
    }
    miniBox.hidden = w.finished;
    fill.style.width = `${Math.min(100, (w.progress / Math.max(1, w.plan.lengthM)) * 100)}%`;
    steps.hidden = w.steps === 0;
    if (w.steps > 0) steps.innerHTML = `${ICONS.steps}<span>${WALK.steps.replace('{n}', String(w.steps))}</span>`;
    const poop = !!w.poop && !w.poop.picked;
    const place = w.pause?.kind === 'place' ? w.plan.events[w.pause.index]?.place : undefined;
    const key = `${w.finished}-${poop}-${place ?? ''}`;
    if (key === lastKey) return;
    lastKey = key;
    action.innerHTML = '';
    if (poop) {
      const b = el('button', 'btn primary', `${ICONS.bag}<span>${WALK.pickup}</span>`);
      b.type = 'button';
      b.dataset.testid = 'walk-pickup';
      b.addEventListener('click', () => h.pickup());
      action.append(b);
    }
    if (place) {
      const box = el('div', 'name-box place-box', `<h2 class="title">${PLACE_LABELS[place]}</h2>`);
      const row = el('div', 'row-buttons');
      const enter = el('button', 'btn primary', `${ICONS.done}<span>${WALK.enter}</span>`);
      enter.type = 'button';
      enter.dataset.testid = 'walk-enter';
      const cont = el('button', 'btn', `${ICONS.paw}<span>${WALK.continue}</span>`);
      cont.type = 'button';
      cont.dataset.testid = 'walk-continue';
      enter.addEventListener('click', () => {
        h.enter();
        if (place !== 'market') box.querySelector('.hint')?.remove();
        if (place === 'park') box.append(el('p', 'hint', WALK.parkSoon));
        if (place === 'gym') box.append(el('p', 'hint', WALK.gymSoon));
      });
      cont.addEventListener('click', () => h.continue());
      row.append(enter, cont);
      box.append(row);
      action.append(box);
    }
    summary.hidden = !w.finished;
    if (w.finished) {
      top.hidden = true;
      const g = h.gains(w);
      const found = w.collected.length
        ? `<div class="found">${w.collected.map((id) => { const d = ITEM_BY_ID[id]; return d ? `<span title="${d.label}">${itemIcon(d)}</span>` : ''; }).join('')}</div>`
        : `<p class="hint">${WALK.nothingFound}</p>`;
      const gains = g ? `<p><strong>${WALK.gains}</strong> : +${g.points} ${'★'} · ${WALK.stamina} +${g.stamina}</p>` : `<p class="hint">${WALK.noRewardNow}</p>`;
      const walked = w.steps > 0 ? `<p data-testid="walk-steps-bonus">${WALK.stepsBonus.replace('{n}', String(w.steps)).replace('{p}', String(g?.stepPoints ?? 0))}</p>` : '';
      summary.innerHTML = `<h2 class="title">${w.progress >= w.plan.lengthM ? WALK.endTitle : WALK.endEarly}</h2><p>${Math.round(w.progress)} m</p><h3 class="subtitle">${WALK.found}</h3>${found}${gains}${walked}`;
      const back = el('button', 'btn primary', `${ICONS.home}<span>${WALK.backHome}</span>`);
      back.type = 'button';
      back.dataset.testid = 'walk-back';
      back.addEventListener('click', () => h.close());
      summary.append(back);
    }
  };
  return { update, destroy: () => root.remove() };
}
