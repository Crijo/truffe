/**
 * D-91 : interface du ménage. Taches restantes, temps du bonus, taches hors de la vue
 * de chaque côté, l'éponge sous le doigt, et « Terminer ».
 */
import { BALANCE } from '../data/balance';
import { CHORES } from '../data/strings';
import { ICONS } from './icons';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

export function mountChoresHud(h: { end(): void }): {
  update(left: number, start: number, tMs: number, offLeft: number, offRight: number): void;
  destroy(): void;
} {
  const root = el('div', 'chores-hud');
  root.dataset.testid = 'chores-hud';
  const top = el('div', 'chores-top');
  const title = el('strong', 'chores-title', `${ICONS.sponge}<span>${CHORES.title}</span>`);
  const count = el('span', 'chores-count');
  count.dataset.testid = 'chores-count';
  const bar = el('span', 'progress chores-time');
  bar.setAttribute('role', 'meter');
  bar.setAttribute('aria-label', CHORES.timeLabel);
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  const fill = el('span', '');
  bar.append(fill);
  const bonus = el('small', 'chores-bonus');
  top.append(title, count, bar, bonus);
  const hint = el('p', 'bath-hint chores-hint', CHORES.hint);
  const left = el('span', 'chores-side left');
  const right = el('span', 'chores-side right');
  const bottom = el('nav', 'bar');
  const done = el('button', 'btn', `${ICONS.done}<span>${CHORES.end}</span>`);
  done.type = 'button';
  done.dataset.testid = 'chores-end';
  done.addEventListener('click', () => h.end());
  bottom.append(done);
  const cursor = el('div', 'tool-cursor');
  cursor.innerHTML = ICONS.sponge;
  cursor.hidden = true;
  root.append(top, hint, left, right, bottom, cursor);
  document.body.append(root);
  window.setTimeout(() => hint.remove(), 3500);

  const place = (e: PointerEvent): void => {
    if (e.target instanceof Element && (bottom.contains(e.target) || top.contains(e.target))) {
      cursor.hidden = true;
      return;
    }
    cursor.hidden = false;
    cursor.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 40}px)`;
  };
  const hide = (): void => {
    cursor.hidden = true;
  };
  window.addEventListener('pointerdown', place);
  window.addEventListener('pointermove', place);
  window.addEventListener('pointerup', hide);

  let key = '';
  return {
    update(nLeft, start, tMs, offL, offR) {
      const lim = BALANCE.chores.limitMs;
      const k = Math.max(0, 1 - tMs / lim);
      const next = `${nLeft}/${start}/${Math.round(k * 100)}/${offL}/${offR}`;
      if (next === key) return;
      key = next;
      count.textContent = CHORES.count.replace('{n}', String(nLeft));
      fill.style.width = `${k * 100}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(k * 100)));
      bonus.textContent = k > 0 ? CHORES.bonus.replace('{s}', String(Math.ceil((lim - tMs) / 1000))) : CHORES.noBonus;
      left.textContent = offL > 0 ? `← ${offL}` : '';
      right.textContent = offR > 0 ? `${offR} →` : '';
      left.hidden = offL === 0;
      right.hidden = offR === 0;
    },
    destroy() {
      window.removeEventListener('pointerdown', place);
      window.removeEventListener('pointermove', place);
      window.removeEventListener('pointerup', hide);
      root.remove();
    },
  };
}
