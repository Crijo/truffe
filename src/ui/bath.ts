/**
 * D-88 : interface de la salle de bain. Quatre étapes affichées en haut (mouiller, savonner,
 * rincer, sécher), l'outil de l'étape choisi tout seul, un mot et une petite cloche à chaque
 * étape finie, et le retour au salon.
 */
import { BATH } from '../data/strings';
import type { BathStage, CareTool } from '../sim/behavior';
import { ICONS } from './icons';

export interface BathHudHandlers {
  setTool(tool: CareTool | null): void;
  close(): void;
}

const ORDER: readonly Exclude<BathStage, 'done'>[] = ['wet', 'soap', 'rinse', 'dry'];
/** Outil de chaque étape. */
export const STAGE_TOOL: Record<Exclude<BathStage, 'done'>, CareTool> = { wet: 'shower', soap: 'soap', rinse: 'shower', dry: 'dryer' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

export function mountBathHud(h: BathHudHandlers): {
  update(stage: BathStage): void;
  /** Étape qu'on vient de finir : mot affiché quelques instants. */
  flash(finished: Exclude<BathStage, 'done'>): void;
  /** Un outil qui ne sert pas encore : on rappelle l'étape en cours. */
  wrongTool(stage: BathStage): void;
  destroy(): void;
} {
  const root = el('div', 'bath-hud');
  root.dataset.testid = 'bath-hud';
  const steps = el('ol', 'bath-steps');
  steps.setAttribute('aria-label', BATH.title);
  const items = ORDER.map((s, i) => {
    const li = el('li', 'bath-step', `<span class="n">${i + 1}</span><span>${BATH.steps[s]}</span>`);
    li.dataset.stage = s;
    steps.append(li);
    return li;
  });
  const hint = el('p', 'bath-hint');
  hint.setAttribute('role', 'status');
  const flashEl = el('div', 'contest-flash bath-flash');
  flashEl.setAttribute('aria-live', 'assertive');

  const bar = el('nav', 'bar bath-bar');
  bar.setAttribute('aria-label', BATH.title);
  const tool = (name: CareTool, label: string): HTMLButtonElement => {
    const b = el('button', 'btn', `${ICONS[name]}<span>${label}</span>`);
    b.type = 'button';
    b.dataset.testid = `bath-${name}`;
    b.addEventListener('click', () => choose(name));
    return b;
  };
  const tShower = tool('shower', 'Douche');
  const tSoap = tool('soap', 'Savon');
  const tDryer = tool('dryer', BATH.dryer);
  const tBack = el('button', 'btn', `${ICONS.home}<span>${BATH.back}</span>`);
  tBack.type = 'button';
  tBack.dataset.testid = 'bath-back';
  tBack.addEventListener('click', () => h.close());
  bar.append(tShower, tSoap, tDryer, tBack);

  const cursor = el('div', 'tool-cursor');
  cursor.hidden = true;
  root.append(steps, hint, flashEl, bar, cursor);
  document.body.append(root);

  let current: CareTool | null = null;
  const choose = (t: CareTool | null): void => {
    current = t;
    h.setTool(t);
    for (const [b, name] of [
      [tShower, 'shower'],
      [tSoap, 'soap'],
      [tDryer, 'dryer'],
    ] as const) {
      b.setAttribute('aria-pressed', String(t === name));
    }
    cursor.innerHTML = t ? ICONS[t] : '';
    cursor.hidden = true;
  };

  // L'outil suit le doigt.
  const place = (e: PointerEvent): void => {
    if (!current || (e.target instanceof Element && bar.contains(e.target))) {
      cursor.hidden = true;
      return;
    }
    cursor.hidden = false;
    cursor.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 64}px)`;
  };
  const hide = (): void => {
    cursor.hidden = true;
  };
  window.addEventListener('pointerdown', place);
  window.addEventListener('pointermove', place);
  window.addEventListener('pointerup', hide);

  let shown: BathStage | null = null;
  let flashTimer = 0;
  return {
    update(stage) {
      if (stage === shown) return;
      shown = stage;
      const at = stage === 'done' ? ORDER.length : ORDER.indexOf(stage);
      items.forEach((li, i) => {
        li.classList.toggle('done', i < at);
        li.classList.toggle('current', i === at);
        if (i === at) li.setAttribute('aria-current', 'step');
        else li.removeAttribute('aria-current');
      });
      hint.textContent = BATH.hints[stage];
      tBack.classList.toggle('primary', stage === 'done');
      choose(stage === 'done' ? null : STAGE_TOOL[stage]);
    },
    flash(finished) {
      flashEl.textContent = BATH.doneWords[finished];
      flashEl.classList.add('on');
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => flashEl.classList.remove('on'), 1400);
    },
    wrongTool(stage) {
      if (stage === 'done') return;
      hint.textContent = BATH.wrongTool.replace('{step}', BATH.steps[stage].toLowerCase());
    },
    destroy() {
      window.removeEventListener('pointerdown', place);
      window.removeEventListener('pointermove', place);
      window.removeEventListener('pointerup', hide);
      window.clearTimeout(flashTimer);
      root.remove();
    },
  };
}
