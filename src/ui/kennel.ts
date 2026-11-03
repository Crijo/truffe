/**
 * Chenil (F-ADO-1 à F-ADO-3) : choisir une race, un chiot, puis lui donner un nom.
 * Les chiots eux-mêmes sont dessinés sur la scène par main.ts.
 */
import { KENNEL, NAME_IDEAS, SEX_LABELS, TEMPERAMENT_HINTS, TEMPERAMENT_LABELS } from '../data/strings';
import type { Candidate } from '../sim/adoption';
import { ICONS } from './icons';

export interface BreedCard {
  id: string;
  label: string;
  price: number;
  portrait: string | null;
  coatLabel: (base: number) => string;
}

export interface KennelHandlers {
  breeds: BreedCard[];
  /** Ouvre la race et renvoie ses 3 chiots. */
  open(breedId: string): Candidate[];
  back(): void;
  /** Met un chiot en avant sur la scène. */
  highlight(index: number | null): void;
  /** Renvoie un message d'erreur, ou null si l'adoption a eu lieu. */
  adopt(index: number, name: string): string | null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

function button(label: string, cls: string): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  return b;
}

/** Boîte de nom, réutilisée pour un chiot déjà là mais sans nom. */
export function nameDialog(root: HTMLElement, title: string, submit: (name: string) => string | null, onBack?: () => void): () => void {
  const box = el('section', 'name-box');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', title);
  const h = el('h2', 'title', title);
  const hint = el('p', 'hint', KENNEL.nameHint);
  const input = el('input', 'name-input');
  input.type = 'text';
  input.maxLength = 16;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Nom du chiot');
  input.dataset.testid = 'name-input';
  const ideas = el('div', 'ideas');
  const pool = [...NAME_IDEAS].sort(() => Math.random() - 0.5).slice(0, 4);
  for (const n of pool) {
    const chip = button(n, 'chip');
    chip.addEventListener('click', () => {
      input.value = n;
      input.focus();
    });
    ideas.append(chip);
  }
  const error = el('p', 'error');
  error.setAttribute('role', 'alert');
  const row = el('div', 'row-buttons');
  const ok = button(`${ICONS.done}<span>${KENNEL.adopt}</span>`, 'btn primary');
  ok.dataset.testid = 'adopt';
  if (onBack) {
    const back = button(`${ICONS.close}<span>${KENNEL.back}</span>`, 'btn');
    back.addEventListener('click', () => {
      box.remove();
      onBack();
    });
    row.append(back);
  }
  row.append(ok);
  box.append(h, hint, input, ideas, error, row);
  root.append(box);
  const go = (): void => {
    const err = submit(input.value);
    if (err) error.textContent = err;
    else box.remove();
  };
  ok.addEventListener('click', go);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });
  input.focus();
  return () => box.remove();
}

export function mountKennel(root: HTMLElement, h: KennelHandlers): { pickAt(index: number): void; destroy(): void } {
  const wrap = el('div', 'kennel');
  wrap.dataset.testid = 'kennel';
  root.append(wrap);

  let litter: Candidate[] = [];
  let selected: number | null = null;
  let litterPanel: HTMLElement | null = null;

  function showBreeds(): void {
    wrap.innerHTML = '';
    wrap.className = 'kennel breeds';
    const head = el('header', 'k-head', `<h1>${KENNEL.title}</h1><p>${KENNEL.chooseBreed}</p>`);
    const grid = el('div', 'k-grid');
    for (const b of h.breeds) {
      const card = button('', 'k-breed');
      card.dataset.breed = b.id;
      card.setAttribute('aria-label', b.label);
      card.innerHTML = `${b.portrait ? `<img alt="" src="${b.portrait}">` : ''}<strong>${b.label}</strong>`;
      card.addEventListener('click', () => showLitter(b));
      grid.append(card);
    }
    wrap.append(head, grid);
  }

  function showLitter(b: BreedCard): void {
    litter = h.open(b.id);
    selected = null;
    wrap.innerHTML = '';
    wrap.className = 'kennel litter';
    const head = el('header', 'k-head small', `<h1>${b.label}</h1><p>${KENNEL.chooseDog}</p>`);
    const back = button(`${ICONS.close}<span>${KENNEL.back}</span>`, 'btn k-back');
    back.addEventListener('click', () => {
      h.back();
      h.highlight(null);
      showBreeds();
    });
    head.append(back);
    litterPanel = el('div', 'k-pups');
    litter.forEach((c, i) => {
      const card = button('', 'k-pup');
      card.dataset.index = String(i);
      card.innerHTML = `<strong>${SEX_LABELS[c.sex]}</strong><span>${TEMPERAMENT_LABELS[c.temperament]}</span><small>${TEMPERAMENT_HINTS[c.temperament]}</small><small>${b.coatLabel(c.coat.base)}</small>`;
      card.setAttribute('aria-label', `${SEX_LABELS[c.sex]}, ${TEMPERAMENT_LABELS[c.temperament]}`);
      card.addEventListener('click', () => pick(i));
      litterPanel?.append(card);
    });
    const choose = button(`${ICONS.done}<span>${KENNEL.pick}</span>`, 'btn primary k-choose');
    choose.dataset.testid = 'choose';
    choose.disabled = true;
    choose.addEventListener('click', () => {
      if (selected === null) return;
      const i = selected;
      const c = litter[i];
      if (!c) return;
      wrap.classList.add('naming');
      nameDialog(root, KENNEL.nameTitle, (name) => h.adopt(i, name), () => wrap.classList.remove('naming'));
    });
    wrap.append(head, litterPanel, choose);
  }

  function pick(i: number): void {
    selected = i;
    h.highlight(i);
    litterPanel?.querySelectorAll('.k-pup').forEach((c, k) => c.setAttribute('aria-pressed', String(k === i)));
    const choose = wrap.querySelector<HTMLButtonElement>('.k-choose');
    if (choose) choose.disabled = false;
  }

  showBreeds();
  return {
    pickAt: (i) => pick(i),
    destroy: () => wrap.remove(),
  };
}
