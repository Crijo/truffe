/** Interface pendant la promenade : avancée, ramasser, lieux, bilan. */
import { PLACE_LABELS } from '../data/city';
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
  gains(w: WalkState): { points: number; stamina: number } | null;
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
  top.append(bar, home);
  const hint = el('p', 'toast walk-hint', WALK.leashHint);
  const action = el('div', 'walk-action');
  const summary = el('section', 'name-box walk-summary');
  summary.hidden = true;
  summary.dataset.testid = 'walk-summary';
  root.append(top, hint, action, summary);
  document.body.append(root);
  window.setTimeout(() => hint.remove(), 4000);

  let lastKey = '';
  const update = (w: WalkState): void => {
    fill.style.width = `${Math.min(100, (w.progress / Math.max(1, w.plan.lengthM)) * 100)}%`;
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
      summary.innerHTML = `<h2 class="title">${w.progress >= w.plan.lengthM ? WALK.endTitle : WALK.endEarly}</h2><p>${Math.round(w.progress)} m</p><h3 class="subtitle">${WALK.found}</h3>${found}${gains}`;
      const back = el('button', 'btn primary', `${ICONS.home}<span>${WALK.backHome}</span>`);
      back.type = 'button';
      back.dataset.testid = 'walk-back';
      back.addEventListener('click', () => h.close());
      summary.append(back);
    }
  };
  return { update, destroy: () => root.remove() };
}
