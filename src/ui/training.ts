/**
 * Dressage dans l'interface (F-DRE) : liste d'ordres (le bouton Micro) et tours de la fiche.
 */
import { TRAINING } from '../data/strings';
import type { TrickId } from '../data/tricks';
import { ICONS } from './icons';

export interface TrickRow {
  trickId: TrickId;
  label: string;
  learned: boolean;
  reps: number;
  needed: number;
  voices: number;
}

export interface TrainingHandlers {
  tricks(): { rows: TrickRow[]; learned: number; max: number };
  order(trickId: TrickId): void;
  call(): void;
  forget(trickId: TrickId): void;
  relabel(trickId: TrickId, label: string): void;
  /** Voix : disponible si le navigateur et le joueur l'autorisent. */
  voice: {
    supported(): boolean;
    record(target: TrickId | 'name'): void;
    clearAll(): void;
    nameVoices(): number;
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

function small(label: string, icon: keyof typeof ICONS, testid: string): HTMLButtonElement {
  const b = el('button', 'mini', `${ICONS[icon]}<span>${label}</span>`);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.dataset.testid = testid;
  return b;
}

/** Contenu de la feuille d'ordres : un bouton par tour appris, et « Viens ». */
export function renderOrders(box: HTMLElement, h: TrainingHandlers, done: () => void): void {
  box.innerHTML = '';
  box.append(el('h2', 'title', TRAINING.ordersTitle));
  const { rows } = h.tricks();
  const learned = rows.filter((r) => r.learned);
  const grid = el('div', 'orders');
  const call = el('button', 'order call', `${ICONS.paw}<span>${TRAINING.call}</span>`);
  call.type = 'button';
  call.dataset.testid = 'order-call';
  call.addEventListener('click', () => {
    h.call();
    done();
  });
  grid.append(call);
  for (const r of learned) {
    const b = el('button', 'order', `<span>${r.label}</span>`);
    b.type = 'button';
    b.dataset.testid = `order-${r.trickId}`;
    b.addEventListener('click', () => {
      h.order(r.trickId);
      done();
    });
    grid.append(b);
  }
  box.append(grid);
  if (learned.length === 0) box.append(el('p', 'hint', TRAINING.noTricks));
  box.append(el('p', 'hint', h.voice.supported() ? TRAINING.holdMic : TRAINING.noMic));
}

/** Section « Tours » de la fiche (F-DRE-6 : renommer, réenregistrer, oublier). */
export function renderTricks(box: HTMLElement, h: TrainingHandlers, refresh: () => void): void {
  box.innerHTML = '';
  const { rows, learned, max } = h.tricks();
  box.append(el('h3', 'subtitle', `${TRAINING.tricksTitle} · ${learned} / ${max}`));
  if (rows.length === 0) {
    box.append(el('p', 'hint', TRAINING.noTricks));
  }
  const list = el('ul', 'tricks');
  for (const r of rows) {
    const li = el('li', `trick ${r.learned ? 'learned' : 'progress'}`);
    li.dataset.trick = r.trickId;
    const dots = r.learned ? `<span class="ok">${ICONS.done}</span>` : `<span class="dots">${'●'.repeat(r.reps)}${'○'.repeat(Math.max(0, r.needed - r.reps))}</span>`;
    li.innerHTML = `<span class="name">${r.label}</span>${dots}`;
    const actions = el('div', 'actions');
    const rename = small(TRAINING.rename, 'card', `rename-${r.trickId}`);
    rename.addEventListener('click', () => {
      const input = el('input', 'name-input small');
      input.value = r.label;
      input.maxLength = 20;
      input.setAttribute('aria-label', TRAINING.rename);
      li.replaceChildren(input);
      input.focus();
      const ok = (): void => {
        h.relabel(r.trickId, input.value);
        refresh();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') ok();
      });
      input.addEventListener('blur', ok);
    });
    const forget = small(TRAINING.forget, 'close', `forget-${r.trickId}`);
    forget.addEventListener('click', () => {
      if (forget.dataset.confirm) {
        h.forget(r.trickId);
        refresh();
      } else {
        forget.dataset.confirm = '1';
        forget.querySelector('span')?.replaceChildren(TRAINING.forgetSure);
      }
    });
    actions.append(rename);
    if (r.learned && h.voice.supported()) {
      const voice = small(r.voices > 0 ? TRAINING.reRecord : TRAINING.record, 'mic', `voice-${r.trickId}`);
      voice.addEventListener('click', () => h.voice.record(r.trickId));
      actions.append(voice);
    }
    actions.append(forget);
    li.append(actions);
    list.append(li);
  }
  box.append(list);

  if (h.voice.supported()) {
    const voiceRow = el('div', 'actions wide');
    const name = small(h.voice.nameVoices() > 0 ? TRAINING.reName : TRAINING.recordName, 'mic', 'voice-name');
    name.addEventListener('click', () => h.voice.record('name'));
    const clear = small(TRAINING.clearVoices, 'close', 'voice-clear');
    clear.addEventListener('click', () => {
      h.voice.clearAll();
      refresh();
    });
    voiceRow.append(name, clear);
    box.append(voiceRow);
  }
}
