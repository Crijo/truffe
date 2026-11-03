/**
 * Interface du salon (DOM) : barre basse, Sac, Fiche, outils de soin.
 * Ne modifie jamais l'état : elle appelle les fonctions fournies par main.ts.
 */
import { NEED_LABELS, UI, type NeedKind, type NeedLevel } from '../data/strings';
import type { BowlKind, CareTool } from '../sim/behavior';
import { ICONS, type IconName } from './icons';

export interface CardRow {
  kind: NeedKind;
  word: string;
  level: NeedLevel;
}

export interface HudHandlers {
  /** Gamelle lâchée en (x, y) écran ; null : posée à l'emplacement habituel. */
  dropBowl(kind: BowlKind, at: { x: number; y: number } | null): void;
  setTool(tool: CareTool | null): void;
  bath(start: boolean): void;
  card(): { rows: CardRow[]; asleep: boolean };
  onChange(fn: () => void): void;
}

const ROW_ICONS: Record<NeedKind, IconName> = { hunger: 'hunger', thirst: 'thirst', cleanliness: 'coat' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

function button(icon: IconName, label: string, cls = 'btn'): HTMLButtonElement {
  const b = el('button', cls, `${ICONS[icon]}<span>${label}</span>`);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  return b;
}

export function mountHud(root: HTMLElement, h: HudHandlers): void {
  const hud = el('div', 'hud');
  root.appendChild(hud);

  // Barre basse.
  const bar = el('nav', 'bar');
  bar.setAttribute('aria-label', 'Actions');
  const bBag = button('bag', UI.bag);
  const bOut = button('out', UI.out);
  const bMic = button('mic', UI.mic);
  const bCard = button('card', UI.card);
  for (const b of [bOut, bMic]) {
    b.disabled = true;
    b.title = UI.soon;
    b.dataset.soon = UI.soon;
  }
  bar.append(bBag, bOut, bMic, bCard);

  // Sac.
  const bag = el('section', 'sheet');
  bag.setAttribute('aria-label', UI.bag);
  bag.hidden = true;
  const bagGrid = el('div', 'grid');
  const iFood = button('food', UI.food, 'item');
  const iWater = button('water', UI.water, 'item');
  const iBrush = button('brush', UI.brush, 'item');
  const iBath = button('bath', UI.bath, 'item');
  iFood.dataset.testid = 'item-food';
  iWater.dataset.testid = 'item-water';
  iBrush.dataset.testid = 'item-brush';
  iBath.dataset.testid = 'item-bath';
  for (const i of [iFood, iWater]) i.append(el('small', 'hint', UI.dragHint));
  bagGrid.append(iFood, iWater, iBrush, iBath);
  const bagClose = button('close', UI.close, 'close');
  bag.append(bagClose, bagGrid);

  // Fiche.
  const card = el('section', 'sheet');
  card.setAttribute('aria-label', UI.card);
  card.dataset.testid = 'card';
  card.hidden = true;
  const cardClose = button('close', UI.close, 'close');
  const cardTitle = el('h2', 'title', UI.puppy);
  const rows = el('ul', 'rows');
  card.append(cardClose, cardTitle, rows);

  // Outils de soin.
  const tools = el('nav', 'bar tools');
  tools.hidden = true;
  const tSoap = button('soap', UI.soap);
  const tShower = button('shower', UI.shower);
  const tTowel = button('towel', UI.towel);
  const tBrush = button('brush', UI.brush);
  const tDone = button('done', UI.done);
  tools.append(tSoap, tShower, tTowel, tBrush, tDone);

  const ghost = el('div', 'ghost');
  ghost.hidden = true;
  const cursor = el('div', 'tool-cursor');
  cursor.hidden = true;

  hud.append(bar, bag, card, tools, ghost, cursor);

  // ------------------------------------------------------------ états
  let mode: 'bar' | 'bath' | 'brush' = 'bar';
  let tool: CareTool | null = null;
  const show = (sheet: HTMLElement | null): void => {
    bag.hidden = sheet !== bag;
    card.hidden = sheet !== card;
    if (sheet === card) renderCard();
  };
  const setTool = (t: CareTool | null): void => {
    tool = t;
    h.setTool(t);
    for (const [b, name] of [
      [tSoap, 'soap'],
      [tShower, 'shower'],
      [tTowel, 'towel'],
      [tBrush, 'brush'],
    ] as const) {
      b.setAttribute('aria-pressed', String(t === name));
    }
    cursor.hidden = t === null;
    cursor.innerHTML = t ? ICONS[t] : '';
  };
  const setMode = (m: typeof mode): void => {
    mode = m;
    bar.hidden = m !== 'bar';
    tools.hidden = m === 'bar';
    for (const b of [tSoap, tShower, tTowel]) b.hidden = m !== 'bath';
    tBrush.hidden = m !== 'brush';
    show(null);
  };

  function renderCard(): void {
    const c = h.card();
    rows.innerHTML = '';
    for (const r of c.rows) {
      const li = el('li', `row level-${r.level}`, `${ICONS[ROW_ICONS[r.kind]]}<span class="label">${NEED_LABELS[r.kind]}</span><strong>${r.word}</strong>`);
      li.dataset.kind = r.kind;
      li.dataset.level = r.level;
      rows.append(li);
    }
    if (c.asleep) rows.append(el('li', 'row asleep', `${ICONS.moon}<span class="label">${UI.asleep}</span>`));
  }
  h.onChange(() => {
    if (!card.hidden) renderCard();
  });

  bBag.addEventListener('click', () => show(bag.hidden ? bag : null));
  bCard.addEventListener('click', () => show(card.hidden ? card : null));
  bagClose.addEventListener('click', () => show(null));
  cardClose.addEventListener('click', () => show(null));
  iBrush.addEventListener('click', () => {
    setMode('brush');
    setTool('brush');
  });
  iBath.addEventListener('click', () => {
    setMode('bath');
    h.bath(true);
    setTool('soap');
  });
  tSoap.addEventListener('click', () => setTool('soap'));
  tShower.addEventListener('click', () => setTool('shower'));
  tTowel.addEventListener('click', () => setTool('towel'));
  tBrush.addEventListener('click', () => setTool('brush'));
  tDone.addEventListener('click', () => {
    if (mode === 'bath') h.bath(false);
    setTool(null);
    setMode('bar');
  });

  // Glisser-déposer des gamelles (F-SOIN-1) ; un simple toucher la pose aussi.
  for (const [item, kind] of [
    [iFood, 'food'],
    [iWater, 'water'],
  ] as const) {
    item.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      item.setPointerCapture(e.pointerId);
      const x0 = e.clientX;
      const y0 = e.clientY;
      let dragging = false;
      ghost.innerHTML = ICONS[kind];
      const move = (ev: PointerEvent): void => {
        if (!dragging && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) {
          dragging = true;
          ghost.hidden = false;
          show(null);
        }
        ghost.style.transform = `translate(${ev.clientX - 32}px, ${ev.clientY - 48}px)`;
      };
      const up = (ev: PointerEvent): void => {
        item.removeEventListener('pointermove', move);
        item.removeEventListener('pointerup', up);
        item.removeEventListener('pointercancel', up);
        ghost.hidden = true;
        show(null);
        const overUi = bar.getBoundingClientRect().top <= ev.clientY;
        h.dropBowl(kind, dragging && !overUi ? { x: ev.clientX, y: ev.clientY } : null);
      };
      item.addEventListener('pointermove', move);
      item.addEventListener('pointerup', up);
      item.addEventListener('pointercancel', up);
    });
  }

  window.addEventListener('pointermove', (e) => {
    if (tool) cursor.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 64}px)`;
  });
}
