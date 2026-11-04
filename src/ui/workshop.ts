/**
 * D-80 : atelier des tours avancés. Liste des 4 tours combinés (ouverts selon le niveau du chiot),
 * puis un jeu de mémoire : le chiot montre une suite de mouvements, le joueur la refait.
 */
import { BALANCE } from '../data/balance';
import { WORKSHOP } from '../data/strings';
import { TRICKS, type TrickId } from '../data/tricks';
import { workshopSequence, type WorkshopTrick } from '../sim/workshop';
import { ICONS } from './icons';
import { panel } from './outings';

const W = BALANCE.workshop;

export interface WorkshopHandlers {
  dogName(): string;
  dogLevel(): number;
  /** Où en est ce tour : appris, répétitions faites et nécessaires, place pour l'apprendre. */
  trick(id: WorkshopTrick): { learned: boolean; reps: number; needed: number; canLearn: boolean };
  /** Graine de la prochaine partie. */
  seed(): number;
  /** Le chiot fait ce mouvement (visuel seulement). */
  perform(id: TrickId): void;
  /** Partie gagnée. */
  done(id: WorkshopTrick): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}
function btn(html: string, cls: string, testid: string): HTMLButtonElement {
  const b = el('button', cls, html);
  b.type = 'button';
  b.dataset.testid = testid;
  return b;
}

/** La liste des tours avancés. */
export function openWorkshop(h: WorkshopHandlers, onClose: () => void): void {
  const p = panel(WORKSHOP.title, null, onClose);
  const render = (): void => {
    p.body.innerHTML = '';
    p.body.append(el('p', 'hint', WORKSHOP.intro.replace('{name}', h.dogName())));
    const list = el('ul', 'workshop-list');
    for (const id of Object.keys(W.levels) as WorkshopTrick[]) {
      const need = W.levels[id];
      const t = h.trick(id);
      const li = el('li', 'workshop-row');
      li.dataset.trick = id;
      const open = h.dogLevel() >= need;
      const state = !open
        ? WORKSHOP.locked.replace('{n}', String(need))
        : t.learned
          ? WORKSHOP.learned
          : `${'●'.repeat(t.reps)}${'○'.repeat(Math.max(0, t.needed - t.reps))}`;
      li.innerHTML = `<span class="name">${open ? '' : ICONS.lock}${TRICKS[id].label}</span><small>${state}</small>`;
      if (open && (t.learned || t.canLearn)) {
        const play = btn(`<span>${t.learned ? WORKSHOP.practice : WORKSHOP.play}</span>`, 'btn mini primary', `workshop-play-${id}`);
        play.addEventListener('click', () => {
          p.root.remove();
          playWorkshop(id, h, () => openWorkshop(h, onClose));
        });
        li.append(play);
      } else if (open) li.append(el('small', 'hint', WORKSHOP.noRoom));
      list.append(li);
    }
    p.body.append(list);
  };
  render();
}

/** Le jeu de mémoire : `rounds` manches de plus en plus longues. */
export function playWorkshop(id: WorkshopTrick, h: WorkshopHandlers, back: () => void): void {
  const root = el('section', 'workshop-game');
  root.dataset.testid = 'workshop-game';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', `${WORKSHOP.title} : ${TRICKS[id].label}`);
  const title = el('h2', 'title', TRICKS[id].label);
  const status = el('p', 'workshop-status');
  status.setAttribute('role', 'status');
  status.dataset.testid = 'workshop-status';
  const grid = el('div', 'workshop-pads');
  const pads = new Map<TrickId, HTMLButtonElement>();
  for (const m of W.pads) {
    const b = btn(`<span>${TRICKS[m].label}</span>`, 'btn workshop-pad', `workshop-pad-${m}`);
    b.dataset.move = m;
    pads.set(m, b);
    grid.append(b);
  }
  const actions = el('div', 'row-buttons');
  const quit = btn(`${ICONS.close}<span>${WORKSHOP.quit}</span>`, 'btn mini', 'workshop-quit');
  actions.append(quit);
  root.append(title, status, grid, actions);
  document.body.append(root);

  const seed = h.seed();
  let round = 0;
  let seq: TrickId[] = [];
  let typed = 0;
  let listening = false;
  const timers: number[] = [];
  const later = (ms: number, f: () => void): void => {
    timers.push(window.setTimeout(f, ms));
  };
  const close = (): void => {
    for (const t of timers) window.clearTimeout(t);
    root.remove();
    back();
  };
  quit.addEventListener('click', close);
  const flash = (m: TrickId, ms: number): void => {
    const b = pads.get(m);
    b?.classList.add('lit');
    later(ms, () => b?.classList.remove('lit'));
  };
  const showRound = (): void => {
    listening = false;
    typed = 0;
    seq = workshopSequence(seed + round * 7919, W.firstLength + round);
    status.textContent = `${WORKSHOP.round.replace('{n}', String(round + 1)).replace('{max}', String(W.rounds))} · ${WORKSHOP.watch}`;
    seq.forEach((m, i) => {
      later(600 + i * W.showMs, () => {
        flash(m, W.showMs * 0.7);
        h.perform(m);
      });
    });
    later(600 + seq.length * W.showMs, () => {
      listening = true;
      status.textContent = `${WORKSHOP.round.replace('{n}', String(round + 1)).replace('{max}', String(W.rounds))} · ${WORKSHOP.yourTurn}`;
    });
  };
  const end = (won: boolean): void => {
    listening = false;
    actions.innerHTML = '';
    if (won) {
      h.done(id);
      const t = h.trick(id);
      status.textContent = t.learned ? WORKSHOP.wonLearned.replace('{name}', h.dogName()) : WORKSHOP.won.replace('{n}', String(Math.max(0, t.needed - t.reps)));
    } else status.textContent = WORKSHOP.lost;
    const again = btn(`<span>${WORKSHOP.again}</span>`, 'btn primary', 'workshop-again');
    again.addEventListener('click', () => {
      for (const t of timers) window.clearTimeout(t);
      root.remove();
      playWorkshop(id, h, back);
    });
    const done = btn(`${ICONS.done}<span>${WORKSHOP.back}</span>`, 'btn', 'workshop-back');
    done.addEventListener('click', close);
    actions.append(again, done);
  };
  for (const [m, b] of pads) {
    b.addEventListener('click', () => {
      if (!listening) return;
      flash(m, 250);
      h.perform(m);
      if (m !== seq[typed]) {
        end(false);
        return;
      }
      typed++;
      if (typed < seq.length) return;
      round++;
      if (round >= W.rounds) end(true);
      else {
        listening = false;
        status.textContent = WORKSHOP.good;
        later(900, showRound);
      }
    });
  }
  showRound();
}
