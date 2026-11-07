/**
 * « Sortir » (F-ECO-3, F-PRO) : promenade, boutique, brocante ; et le carnet (F-ECO-4).
 * L'interface appelle les fonctions fournies ; elle ne touche jamais à l'état.
 */
import { ITEMS, ITEM_BY_ID, type ItemCategory, type ItemId } from '../data/items';
import { CONTEST, FAMILY, KENNEL, OUT } from '../data/strings';
import { TRICKS, TRICK_IDS, type TrickId } from '../data/tricks';
import { ICONS } from './icons';
import { itemIcon } from './itemIcon';

export interface OutingHandlers {
  coins(): number;
  shop(): { id: ItemId; price: number }[];
  market(): { id: ItemId; price: number }[];
  inventory(): Record<ItemId, number>;
  discovered(): ItemId[];
  learnedTricks(): TrickId[];
  /** Renvoie un message d'erreur, ou null. */
  buy(id: ItemId, where: 'shop' | 'market'): string | null;
  sell(id: ItemId): void;
  openMap(): void;
  /** D-96 : la salle de bain est un endroit du menu, plus un objet du Sac. */
  openBath(): void;
  /** D-98 : aller au jardin, ou rentrer au salon. */
  openGarden(): void;
  inGarden(): boolean;
  openContests(): void;
  openKennel(): void;
  openFamily(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

function btn(html: string, cls: string, testid?: string): HTMLButtonElement {
  const b = el('button', cls, html);
  b.type = 'button';
  if (testid) b.dataset.testid = testid;
  return b;
}

/** Panneau plein écran avec un titre, les pièces et un bouton Fermer. */
export function panel(title: string, coins: number | null, onClose: () => void): { root: HTMLElement; body: HTMLElement; setCoins(n: number): void; close(): void } {
  const root = el('section', 'panel');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', title);
  const head = el('header', 'panel-head', `<h2>${title}</h2>`);
  const purse = el('span', 'coins');
  purse.dataset.testid = 'coins';
  const setCoins = (n: number): void => {
    purse.innerHTML = `${ICONS.coin}<span>${n}</span>`;
    purse.setAttribute('aria-label', `${n} ${OUT.coins}`);
  };
  if (coins !== null) {
    setCoins(coins);
    head.append(purse);
  }
  const close = btn(`${ICONS.close}<span>${OUT.close}</span>`, 'btn panel-close', 'panel-close');
  const done = (): void => {
    root.remove();
    onClose();
  };
  close.addEventListener('click', done);
  head.append(close);
  const body = el('div', 'panel-body');
  root.append(head, body);
  document.body.append(root);
  return { root, body, setCoins, close: done };
}

const CATS: { id: ItemCategory; label: string }[] = [
  { id: 'food', label: OUT.food },
  { id: 'toy', label: OUT.toys },
  { id: 'accessory', label: OUT.accessories },
  { id: 'care', label: OUT.care },
];

function card(id: ItemId, extra: string): HTMLElement {
  const def = ITEM_BY_ID[id];
  const c = el('div', 'shop-card', `${def ? itemIcon(def) : ''}<strong>${def?.label ?? id}</strong>${extra}`);
  c.dataset.item = id;
  return c;
}

/** Boutique : nourriture, jouets, accessoires, soins. */
export function openShop(h: OutingHandlers, onClose: () => void): void {
  const p = panel(OUT.shop, h.coins(), onClose);
  const tabs = el('nav', 'tabs');
  const list = el('div', 'shop-grid');
  const msg = el('p', 'hint');
  msg.setAttribute('role', 'status');
  let cat: ItemCategory = 'food';
  const render = (): void => {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
    list.innerHTML = '';
    for (const o of h.shop().filter((x) => ITEM_BY_ID[x.id]?.category === cat)) {
      const c = card(o.id, `<span class="price">${ICONS.coin}${o.price}</span>`);
      const b = btn(OUT.buy, 'mini buy', `buy-${o.id}`);
      b.disabled = h.coins() < o.price;
      b.addEventListener('click', () => {
        const err = h.buy(o.id, 'shop');
        msg.textContent = err ?? `${ITEM_BY_ID[o.id]?.label ?? ''} : ${OUT.added}`;
        p.setCoins(h.coins());
        render();
      });
      c.append(b);
      list.append(c);
    }
  };
  for (const c of CATS) {
    const b = btn(c.label, 'tab');
    b.dataset.cat = c.id;
    b.addEventListener('click', () => {
      cat = c.id;
      render();
    });
    tabs.append(b);
  }
  p.body.append(tabs, msg, list);
  render();
}

/** Brocante : le stock du jour, et le rachat de ce qu'on a. */
export function openMarket(h: OutingHandlers, onClose: () => void): void {
  const p = panel(OUT.market, h.coins(), onClose);
  const msg = el('p', 'hint');
  msg.setAttribute('role', 'status');
  const buyList = el('div', 'shop-grid');
  const sellList = el('div', 'shop-grid');
  const render = (): void => {
    buyList.innerHTML = '';
    const inv = h.inventory();
    for (const o of h.market()) {
      const c = card(o.id, `<span class="price">${ICONS.coin}${o.price}</span>`);
      const b = btn(OUT.buy, 'mini buy', `mbuy-${o.id}`);
      b.disabled = h.coins() < o.price;
      b.addEventListener('click', () => {
        msg.textContent = h.buy(o.id, 'market') ?? `${ITEM_BY_ID[o.id]?.label ?? ''} : ${OUT.added}`;
        p.setCoins(h.coins());
        render();
      });
      c.append(b);
      buyList.append(c);
    }
    sellList.innerHTML = '';
    // D-97 : les croquettes ne se revendent pas.
    const owned = Object.entries(inv).filter(([id, n]) => n > 0 && !ITEM_BY_ID[id]?.pack);
    if (owned.length === 0) sellList.append(el('p', 'hint', OUT.nothingToSell));
    for (const [id, n] of owned) {
      const def = ITEM_BY_ID[id];
      if (!def) continue;
      const c = card(id, `<span class="count">× ${n}</span><span class="price">${ICONS.coin}${def.resale}</span>`);
      const b = btn(OUT.sell, 'mini', `sell-${id}`);
      b.addEventListener('click', () => {
        h.sell(id);
        msg.textContent = `${def.label} : ${OUT.sold}`;
        p.setCoins(h.coins());
        render();
      });
      c.append(b);
      sellList.append(c);
    }
  };
  p.body.append(msg, el('h3', 'subtitle', OUT.todayStock), buyList, el('h3', 'subtitle', OUT.resell), sellList);
  render();
}

/** Menu « Sortir ». */
export function openOutings(h: OutingHandlers, onClose: () => void): void {
  const p = panel(OUT.title, h.coins(), onClose);
  const grid = el('div', 'out-grid');
  const walk = btn(`${ICONS.map}<strong>${OUT.walk}</strong><small>${OUT.walkHint}</small>`, 'out-choice', 'out-walk');
  const shop = btn(`${ICONS.bag}<strong>${OUT.shop}</strong><small>${OUT.shopHint}</small>`, 'out-choice', 'out-shop');
  const market = btn(`${ICONS.tag}<strong>${OUT.market}</strong><small>${OUT.marketHint}</small>`, 'out-choice', 'out-market');
  walk.addEventListener('click', () => {
    p.root.remove();
    h.openMap();
  });
  shop.addEventListener('click', () => {
    p.root.remove();
    openShop(h, onClose);
  });
  market.addEventListener('click', () => {
    p.root.remove();
    openMarket(h, onClose);
  });
  const bath = btn(`${ICONS.bath}<strong>${OUT.bath}</strong><small>${OUT.bathHint}</small>`, 'out-choice', 'out-bath');
  bath.addEventListener('click', () => {
    p.root.remove();
    h.openBath();
  });
  const outside = h.inGarden();
  const garden = btn(`${outside ? ICONS.home : ICONS.tree}<strong>${outside ? OUT.home : OUT.garden}</strong><small>${outside ? OUT.homeHint : OUT.gardenHint}</small>`, 'out-choice', 'out-garden');
  garden.addEventListener('click', () => {
    p.root.remove();
    h.openGarden();
  });
  const contests = btn(`${ICONS.trophy}<strong>${CONTEST.title}</strong><small>${CONTEST.hint}</small>`, 'out-choice', 'out-contests');
  const kennel = btn(`${ICONS.home}<strong>${KENNEL.title}</strong><small>${FAMILY.adoptHint}</small>`, 'out-choice', 'out-kennel');
  const family = btn(`${ICONS.paw}<strong>${FAMILY.title}</strong><small>${FAMILY.hint}</small>`, 'out-choice', 'out-family');
  for (const [b, go] of [
    [contests, h.openContests],
    [kennel, h.openKennel],
    [family, h.openFamily],
  ] as const) {
    b.addEventListener('click', () => {
      p.root.remove();
      go();
    });
  }
  grid.append(garden, bath, walk, contests, shop, market, kennel, family);
  p.body.append(grid);
}

/** Carnet de collection : objets et tours, silhouettes pour ce qui reste à découvrir (F-ECO-4). */
export function openBook(h: OutingHandlers, onClose: () => void): void {
  const p = panel(OUT.book, null, onClose);
  const found = new Set(h.discovered());
  const learned = new Set(h.learnedTricks());
  p.body.append(el('h3', 'subtitle', `${OUT.objects} · ${ITEMS.filter((i) => found.has(i.id)).length} / ${ITEMS.length}`));
  const grid = el('div', 'book-grid');
  for (const def of ITEMS) {
    const known = found.has(def.id);
    const c = el('div', `book-cell ${known ? 'known' : 'unknown'}`, `${itemIcon(def, !known)}<small>${known ? def.label : '?'}</small>`);
    c.dataset.item = def.id;
    grid.append(c);
  }
  p.body.append(grid);
  p.body.append(el('h3', 'subtitle', `${OUT.tricks} · ${TRICK_IDS.filter((t) => learned.has(t)).length} / ${TRICK_IDS.length}`));
  const tricks = el('div', 'book-grid tricks');
  for (const id of TRICK_IDS) {
    const known = learned.has(id);
    const c = el('div', `book-cell ${known ? 'known' : 'unknown'}`, `${ICONS.paw}<small>${known ? TRICKS[id].label : '?'}</small>`);
    c.dataset.trick = id;
    tricks.append(c);
  }
  p.body.append(tricks);
}
