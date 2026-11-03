/**
 * Interface du salon (DOM) : barre basse, Sac, Fiche, outils de soin.
 * Ne modifie jamais l'état : elle appelle les fonctions fournies par main.ts.
 */
import { NEED_LABELS, SEX_LABELS, TEMPERAMENT_LABELS, TOY_HINT, TOY_LABELS, UI, type NeedKind, type NeedLevel } from '../data/strings';
import type { BowlKind, CareTool } from '../sim/behavior';
import type { Sex, TemperamentId } from '../sim/state';
import type { ToyKind } from '../sim/toys';
import { ICONS, type IconName } from './icons';
import { renderOrders, renderTricks, type TrainingHandlers } from './training';

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
  card(): { rows: CardRow[]; asleep: boolean; name: string; breed: string; sex: Sex; temperament: TemperamentId };
  /** Jouet choisi : le prochain appui sur la scène le prend en main. */
  armToy(kind: ToyKind): void;
  onChange(fn: () => void): void;
  training: TrainingHandlers;
  /** Micro maintenu : commencer ou finir d'écouter un ordre à la voix. */
  micHold(start: boolean): void;
}

/** Durée d'appui au-delà de laquelle le bouton Micro écoute au lieu d'ouvrir la liste. */
const MIC_HOLD_MS = 280;

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

export function mountHud(root: HTMLElement, h: HudHandlers): { toast(text: string): void } {
  const hud = el('div', 'hud');
  root.appendChild(hud);

  // Barre basse.
  const bar = el('nav', 'bar');
  bar.setAttribute('aria-label', 'Actions');
  const bBag = button('bag', UI.bag);
  const bOut = button('out', UI.out);
  const bMic = button('mic', UI.mic);
  const bCard = button('card', UI.card);
  bMic.dataset.testid = 'mic';
  for (const b of [bOut]) {
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
  const toyItems = (['ball', 'disc', 'rope'] as const).map((k) => {
    const b = button(k, TOY_LABELS[k], 'item');
    b.dataset.testid = `item-${k}`;
    b.addEventListener('click', () => {
      show(null);
      h.armToy(k);
      toast(TOY_HINT);
    });
    return b;
  });
  bagGrid.append(iFood, iWater, iBrush, iBath, ...toyItems);
  const bagClose = button('close', UI.close, 'close');
  bag.append(bagClose, bagGrid);

  // Fiche.
  const card = el('section', 'sheet');
  card.setAttribute('aria-label', UI.card);
  card.dataset.testid = 'card';
  card.hidden = true;
  const cardClose = button('close', UI.close, 'close');
  const cardTitle = el('h2', 'title', UI.puppy);
  const cardSub = el('p', 'sub');
  const rows = el('ul', 'rows');
  const tricksBox = el('section', 'tricks-box');
  card.append(cardClose, cardTitle, cardSub, rows, tricksBox);

  // Liste d'ordres (bouton Micro touché brièvement).
  const orders = el('section', 'sheet');
  orders.setAttribute('aria-label', 'Ordres');
  orders.dataset.testid = 'orders';
  orders.hidden = true;
  const ordersClose = button('close', UI.close, 'close');
  const ordersBox = el('div', 'orders-box');
  orders.append(ordersClose, ordersBox);

  // Outils de soin.
  const tools = el('nav', 'bar tools');
  tools.hidden = true;
  const tSoap = button('soap', UI.soap);
  const tShower = button('shower', UI.shower);
  const tTowel = button('towel', UI.towel);
  const tBrush = button('brush', UI.brush);
  const tDone = button('done', UI.done);
  tools.append(tSoap, tShower, tTowel, tBrush, tDone);

  const toastEl = el('div', 'toast');
  toastEl.setAttribute('role', 'status');
  toastEl.hidden = true;
  let toastTimer = 0;
  const toast = (text: string): void => {
    toastEl.textContent = text;
    toastEl.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toastEl.hidden = true), 2600);
  };
  const ghost = el('div', 'ghost');
  ghost.hidden = true;
  const cursor = el('div', 'tool-cursor');
  cursor.hidden = true;

  hud.append(bar, bag, card, orders, tools, toastEl, ghost, cursor);

  // ------------------------------------------------------------ états
  let mode: 'bar' | 'bath' | 'brush' = 'bar';
  let tool: CareTool | null = null;
  const show = (sheet: HTMLElement | null): void => {
    bag.hidden = sheet !== bag;
    card.hidden = sheet !== card;
    orders.hidden = sheet !== orders;
    if (sheet === card) renderCard();
    if (sheet === orders) renderOrders(ordersBox, h.training, () => show(null));
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
    cardTitle.textContent = c.name;
    cardSub.textContent = `${c.breed} · ${SEX_LABELS[c.sex]} · ${TEMPERAMENT_LABELS[c.temperament]}`;
    rows.innerHTML = '';
    for (const r of c.rows) {
      const li = el('li', `row level-${r.level}`, `${ICONS[ROW_ICONS[r.kind]]}<span class="label">${NEED_LABELS[r.kind]}</span><strong>${r.word}</strong>`);
      li.dataset.kind = r.kind;
      li.dataset.level = r.level;
      rows.append(li);
    }
    if (c.asleep) rows.append(el('li', 'row asleep', `${ICONS.moon}<span class="label">${UI.asleep}</span>`));
    renderTricks(tricksBox, h.training, renderCard);
  }
  h.onChange(() => {
    if (!card.hidden) renderCard();
  });

  bBag.addEventListener('click', () => show(bag.hidden ? bag : null));
  bCard.addEventListener('click', () => show(card.hidden ? card : null));
  ordersClose.addEventListener('click', () => show(null));
  // Micro : appui bref → liste d'ordres ; appui maintenu → écoute à la voix.
  let micTimer = 0;
  let micHeld = false;
  bMic.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    bMic.setPointerCapture(e.pointerId);
    micHeld = false;
    if (!h.training.voice.supported()) return;
    micTimer = window.setTimeout(() => {
      micHeld = true;
      bMic.setAttribute('aria-pressed', 'true');
      h.micHold(true);
    }, MIC_HOLD_MS);
  });
  const micUp = (): void => {
    window.clearTimeout(micTimer);
    if (micHeld) {
      micHeld = false;
      bMic.setAttribute('aria-pressed', 'false');
      h.micHold(false);
    } else show(orders.hidden ? orders : null);
  };
  bMic.addEventListener('pointerup', micUp);
  bMic.addEventListener('pointercancel', () => {
    window.clearTimeout(micTimer);
    if (micHeld) h.micHold(false);
    micHeld = false;
  });
  bMic.addEventListener('click', (e) => e.preventDefault());
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
  return { toast };
}
