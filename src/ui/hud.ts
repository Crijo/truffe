/**
 * Interface du salon (DOM) : barre basse, Sac, Fiche, outils de soin.
 * Ne modifie jamais l'état : elle appelle les fonctions fournies par main.ts.
 */
import { capturePointer } from '../input/capture';
import { NEED_LABELS, SEX_LABELS, TEMPERAMENT_LABELS, TOY_HINT, TOY_LABELS, UI, type NeedKind, type NeedLevel } from '../data/strings';
import type { BowlKind, CareTool } from '../sim/behavior';
import type { Sex, TemperamentId } from '../sim/state';
import type { ToyKind } from '../sim/toys';
import { ICONS, type IconName } from './icons';
import { renderOrders, renderTricks, type TrainingHandlers } from './training';
import { ITEM_BY_ID } from '../data/items';
import { LEVELS, OUT, SETTINGS, TRAINING, WORKSHOP } from '../data/strings';
import { itemIcon } from './itemIcon';

export interface CardRow {
  kind: NeedKind;
  word: string;
  level: NeedLevel;
  /** Jauge de 0 à 100 (D-70 : affichée en barre). */
  value: number;
}

/** Barre d'état : le mot reste lu par les lecteurs d'écran. */
function gauge(r: CardRow): string {
  const v = Math.round(Math.min(100, Math.max(0, r.value)));
  return `<span class="gauge-bar" role="meter" aria-label="${NEED_LABELS[r.kind]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-valuetext="${r.word}"><span style="width:${v}%"></span></span><span class="sr">${r.word}</span>`;
}

/** D-78 : niveau, XP dans le niveau, XP qu'il demande. */
export interface LevelInfo {
  level: number;
  into: number;
  need: number;
}

export interface HudHandlers {
  /** Gamelle lâchée en (x, y) écran ; null : posée à l'emplacement habituel. */
  dropBowl(kind: BowlKind, at: { x: number; y: number } | null): void;
  setTool(tool: CareTool | null): void;
  bath(start: boolean): void;
  card(): { rows: CardRow[]; asleep: boolean; name: string; breed: string; sex: Sex; temperament: TemperamentId; obedience: number | null; levels: { dog: LevelInfo; player: LevelInfo } };
  /** Jouet choisi : le prochain appui sur la scène le prend en main. */
  armToy(kind: ToyKind): void;
  onChange(fn: () => void): void;
  training: TrainingHandlers;
  /** Objets du sac (F-ECO-3) et ce qu'on en fait. */
  items: {
    owned(): { id: string; count: number; worn: boolean }[];
    use(id: string): void;
    equip(id: string): void;
    armToy(id: string): void;
  };
  openOutings(): void;
  openSettings(): void;
  openBook(): void;
  /** D-80 : atelier des tours avancés. */
  openWorkshop(): void;
  /** Barres toujours visibles du chiot actif ; `fn` est rappelée à chaque changement d'état. */
  status(): { name: string | null; rows: CardRow[]; level: number };
  onStatus(fn: () => void): void;
  /** Micro maintenu : commencer ou finir d'écouter un ordre à la voix. */
  micHold(start: boolean): void;
  /** D-35 : la corde du salon arrive avec le premier déblocage. */
  ropeUnlocked(): boolean;
  /** D-71 : jouets qui traînent au salon, et les ranger. */
  toysOut(): number;
  putAwayToys(): void;
}

/** Durée d'appui au-delà de laquelle le bouton Micro écoute au lieu d'ouvrir la liste. */
const MIC_HOLD_MS = 280;

const ROW_ICONS: Record<NeedKind, IconName> = { hunger: 'hunger', thirst: 'thirst', cleanliness: 'coat', fun: 'ball' };

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

export function mountHud(root: HTMLElement, h: HudHandlers): { toast(text: string): void; petting(at: { x: number; y: number }): void } {
  const hud = el('div', 'hud');
  root.appendChild(hud);

  // Barre basse.
  const bar = el('nav', 'bar');
  bar.setAttribute('aria-label', 'Actions');
  const bBag = button('bag', UI.bag);
  const bOut = button('out', UI.out);
  const bMic = button('mic', UI.mic);
  const bSettings = button('settings', SETTINGS.title);
  bSettings.dataset.testid = 'settings';
  bSettings.addEventListener('click', () => {
    show(null);
    h.openSettings();
  });
  bMic.dataset.testid = 'mic';
  bOut.dataset.testid = 'out';
  bOut.addEventListener('click', () => {
    show(null);
    h.openOutings();
  });
  bar.append(bBag, bOut, bMic, bSettings);

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
  const putAway = button('done', UI.putAway, 'mini');
  putAway.dataset.testid = 'put-away';
  putAway.addEventListener('click', () => {
    h.putAwayToys();
    show(null);
    toast(UI.putAwayDone);
  });
  const ownedTitle = el('h3', 'subtitle', OUT.myItems);
  const ownedGrid = el('div', 'grid owned');
  bag.append(bagClose, bagGrid, putAway, ownedTitle, ownedGrid);
  const renderOwned = (): void => {
    ownedGrid.innerHTML = '';
    const owned = h.items.owned();
    ownedTitle.hidden = owned.length === 0;
    for (const o of owned) {
      const def = ITEM_BY_ID[o.id];
      if (!def) continue;
      const verb = def.slot ? (o.worn ? OUT.worn : OUT.wear) : def.toyKind ? '' : def.food?.treat ? OUT.give : def.category === 'found' ? '' : OUT.use;
      const b = el('button', `item owned${o.worn ? ' worn' : ''}`, `${itemIcon(def)}<span>${def.label}</span><small class="hint">× ${o.count}${verb ? ` · ${verb}` : ''}</small>`);
      b.type = 'button';
      b.dataset.testid = `own-${o.id}`;
      b.setAttribute('aria-pressed', String(o.worn));
      b.addEventListener('click', () => {
        if (def.slot) {
          h.items.equip(o.id);
          renderOwned();
        } else if (def.toyKind) {
          show(null);
          h.items.armToy(o.id);
          toast(TOY_HINT);
        } else if (def.category !== 'found') {
          show(null);
          h.items.use(o.id);
        }
      });
      ownedGrid.append(b);
    }
  };

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
  const bookBtn = button('book', OUT.book, 'mini');
  bookBtn.dataset.testid = 'open-book';
  bookBtn.addEventListener('click', () => {
    show(null);
    h.openBook();
  });
  const workshopBtn = button('star', WORKSHOP.open, 'mini');
  workshopBtn.dataset.testid = 'open-workshop';
  workshopBtn.addEventListener('click', () => {
    show(null);
    h.openWorkshop();
  });
  const levelsBox = el('ul', 'levels');
  levelsBox.dataset.testid = 'levels';
  const cardLinks = el('div', 'row-buttons card-links');
  cardLinks.append(bookBtn, workshopBtn);
  card.append(cardClose, cardTitle, cardSub, levelsBox, rows, cardLinks, tricksBox);

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

  // Barres d'état, toujours visibles (D-70).
  const status = el('div', 'status');
  status.setAttribute('role', 'button');
  status.tabIndex = 0;
  status.setAttribute('aria-label', UI.card);
  status.dataset.testid = 'status';
  let statusKey = '';
  const renderStatus = (): void => {
    const st = h.status();
    const key = `${st.name ?? ''}${st.level}` + st.rows.map((r) => `${r.kind}${Math.round(r.value)}${r.level}`).join();
    if (key === statusKey) return;
    statusKey = key;
    status.innerHTML = `<strong class="status-name" data-testid="status-level">${st.name ? `${st.name} · ` : ''}<small>${LEVELS.short} ${st.level}</small></strong>` + st.rows.map((r) => `<div class="gauge level-${r.level}" data-kind="${r.kind}">${ICONS[ROW_ICONS[r.kind]]}<span class="gauge-body"><small aria-hidden="true">${NEED_LABELS[r.kind]}</small>${gauge(r)}</span></div>`).join('');
  };
  renderStatus();
  h.onStatus(renderStatus);
  status.addEventListener('click', () => show(card.hidden ? card : null));
  status.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      show(card.hidden ? card : null);
    }
  });

  hud.append(status, bar, bag, card, orders, tools, toastEl, ghost, cursor);

  // ------------------------------------------------------------ états
  let mode: 'bar' | 'bath' | 'brush' = 'bar';
  let tool: CareTool | null = null;
  const show = (sheet: HTMLElement | null): void => {
    bag.hidden = sheet !== bag;
    card.hidden = sheet !== card;
    orders.hidden = sheet !== orders;
    if (sheet === bag) {
      renderOwned();
      const rope = toyItems[2];
      if (rope) rope.hidden = !h.ropeUnlocked();
      putAway.hidden = h.toysOut() === 0;
    }
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
    const lvRow = (who: string, l: LevelInfo, kind: string): string => {
      const v = Math.round((l.into / l.need) * 100);
      return `<li class="level-row" data-kind="${kind}"><span class="label">${who}</span><strong>${LEVELS.level} ${l.level}</strong><span class="gauge-bar" role="meter" aria-label="${LEVELS.xp} : ${who}" aria-valuemin="0" aria-valuemax="${l.need}" aria-valuenow="${l.into}"><span style="width:${Math.max(3, v)}%"></span></span><small>${l.into} / ${l.need} ${LEVELS.xp}</small></li>`;
    };
    levelsBox.innerHTML = lvRow(c.name, c.levels.dog, 'dog') + lvRow(LEVELS.you, c.levels.player, 'player');
    rows.innerHTML = '';
    for (const r of c.rows) {
      const li = el('li', `row level-${r.level}`, `${ICONS[ROW_ICONS[r.kind]]}<span class="label">${NEED_LABELS[r.kind]}</span>${gauge(r)}`);
      li.dataset.kind = r.kind;
      li.dataset.level = r.level;
      rows.append(li);
    }
    if (c.obedience !== null) {
      const v = Math.round(c.obedience * 100);
      const li = el('li', 'row obedience', `${ICONS.paw}<span class="label">${TRAINING.obedience}</span><span class="gauge-bar" role="meter" aria-label="${TRAINING.obedience}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}"><span style="width:${v}%"></span></span>`);
      li.dataset.kind = 'obedience';
      rows.append(li);
    }
    if (c.asleep) rows.append(el('li', 'row asleep', `${ICONS.moon}<span class="label">${UI.asleep}</span>`));
    renderTricks(tricksBox, h.training, renderCard);
  }
  h.onChange(() => {
    if (!card.hidden) renderCard();
  });

  bBag.addEventListener('click', () => show(bag.hidden ? bag : null));
  ordersClose.addEventListener('click', () => show(null));
  // Micro : appui bref → liste d'ordres ; appui maintenu → écoute à la voix.
  let micTimer = 0;
  let micHeld = false;
  bMic.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    capturePointer(bMic, e.pointerId);
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
      capturePointer(item, e.pointerId);
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

  // L'outil, ou la main qui caresse, suit le doigt dès qu'il touche l'écran.
  let petting = false;
  const place = (x: number, y: number): void => {
    cursor.style.transform = `translate(${x - 20}px, ${y - 64}px)`;
  };
  window.addEventListener('pointerdown', (e) => {
    if (tool) place(e.clientX, e.clientY);
  });
  window.addEventListener('pointermove', (e) => {
    if (tool || petting) place(e.clientX, e.clientY);
  });
  const endPetting = (): void => {
    if (!petting) return;
    petting = false;
    cursor.classList.remove('hand');
    cursor.hidden = tool === null;
    cursor.innerHTML = tool ? ICONS[tool] : '';
  };
  window.addEventListener('pointerup', endPetting);
  window.addEventListener('pointercancel', endPetting);
  return {
    toast,
    petting(at) {
      if (tool) return;
      petting = true;
      cursor.innerHTML = ICONS.hand;
      cursor.classList.add('hand');
      cursor.hidden = false;
      place(at.x, at.y);
    },
  };
}
