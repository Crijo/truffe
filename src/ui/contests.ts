/**
 * Concours (F-CON) : choix de l'épreuve, affichage pendant l'épreuve, résultats.
 * L'interface appelle les fonctions fournies ; elle ne touche jamais à l'état.
 */
import { BALANCE } from '../data/balance';
import { CLASS_NAMES, CONTEST, CONTEST_NAMES, UI } from '../data/strings';
import type { TrickId } from '../data/tricks';
import type { ContestResult, EntryRefusal } from '../sim/contests';
import type { ContestSession } from '../sim/game';
import type { ContestClass, ContestId } from '../sim/state';
import { ICONS } from './icons';
import { panel } from './outings';

export interface ContestMenuHandlers {
  coins(): number;
  dogName(): string;
  info(c: ContestId): { contestClass: ContestClass; trophies: number; refusal: EntryRefusal | null };
  prizesLeft(): number;
  enter(c: ContestId): void;
}

const ORDER: ContestId[] = ['disc', 'agility', 'obedience'];
const ICON: Record<ContestId, string> = { disc: ICONS.disc, agility: ICONS.trophy, obedience: ICONS.paw };

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

/** Les 3 concours, la classe du chiot et, s'il ne peut pas s'inscrire, pourquoi (F-CON-7). */
export function openContests(h: ContestMenuHandlers, onClose: () => void): void {
  const p = panel(CONTEST.title, h.coins(), onClose);
  const left = h.prizesLeft();
  p.body.append(el('p', 'hint', left > 0 ? CONTEST.prizesLeft.replace('{n}', String(left)) : CONTEST.forFun));
  const grid = el('div', 'out-grid');
  for (const c of ORDER) {
    const info = h.info(c);
    const card = el('div', 'contest-card');
    card.dataset.contest = c;
    card.append(el('div', 'contest-head', `${ICON[c]}<strong>${CONTEST_NAMES[c]}</strong><small>${CLASS_NAMES[info.contestClass]} · ${ICONS.trophy}${info.trophies}</small>`));
    if (info.refusal) {
      const why = el('p', 'contest-why', CONTEST.refusal(info.refusal, c, h.dogName()));
      why.dataset.testid = `refusal-${c}`;
      card.append(why);
    } else {
      const go = btn(`<span>${CONTEST.enter}</span>`, 'btn primary', `enter-${c}`);
      go.addEventListener('click', () => {
        p.root.remove();
        h.enter(c);
      });
      card.append(go);
    }
    grid.append(card);
  }
  p.body.append(grid);
}

export interface ContestHudHandlers {
  quit(): void;
  close(): void;
  order(trickId: TrickId): void;
  /** Tours appris, pour les boutons d'obéissance. */
  tricks(): { id: TrickId; label: string }[];
  micSupported(): boolean;
  micHold(start: boolean): void;
  dogName(): string;
}

const fmt = (ms: number): string => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;

/** Pendant l'épreuve : temps, score, consignes ; puis le bilan. */
export function mountContestHud(session: ContestSession, h: ContestHudHandlers): { update(s: ContestSession): void; destroy(): void } {
  const root = el('div', 'contest-hud');
  root.dataset.testid = 'contest-hud';
  const top = el('header', 'contest-top');
  const title = el('strong', 'contest-title', `${CONTEST_NAMES[session.contestId]} · ${CLASS_NAMES[session.contestClass]}`);
  const clock = el('span', 'contest-clock');
  clock.dataset.testid = 'contest-clock';
  const score = el('span', 'contest-score');
  score.dataset.testid = 'contest-score';
  const quit = btn(`${ICONS.close}<span>${CONTEST.quit}</span>`, 'btn mini', 'contest-quit');
  quit.addEventListener('click', () => h.quit());
  top.append(title, clock, score, quit);
  const hint = el('p', 'contest-hint', session.contestId === 'disc' ? CONTEST.discHint : session.contestId === 'agility' ? CONTEST.agilityHint : CONTEST.obedienceHint);
  if (!session.prize) hint.append(el('small', '', ` ${CONTEST.forFun}`));
  const flash = el('div', 'contest-flash');
  flash.setAttribute('role', 'status');
  root.append(top, hint, flash);

  // Obéissance : l'ordre demandé, le temps qui reste, les boutons.
  const orderBox = el('section', 'contest-orders');
  const wanted = el('p', 'contest-wanted');
  wanted.dataset.testid = 'contest-wanted';
  const bar = el('div', 'progress', '<span></span>');
  const buttons = el('div', 'orders-grid');
  if (session.contestId === 'obedience') {
    for (const t of h.tricks()) {
      const b = btn(`<span>${t.label}</span>`, 'btn order', `contest-order-${t.id}`);
      b.addEventListener('click', () => h.order(t.id));
      buttons.append(b);
    }
    if (h.micSupported()) {
      const mic = btn(`${ICONS.mic}<span>${UI.mic}</span>`, 'btn order mic', 'contest-mic');
      mic.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        mic.setPointerCapture(e.pointerId);
        mic.setAttribute('aria-pressed', 'true');
        h.micHold(true);
      });
      const up = (): void => {
        mic.setAttribute('aria-pressed', 'false');
        h.micHold(false);
      };
      mic.addEventListener('pointerup', up);
      mic.addEventListener('pointercancel', up);
      buttons.append(mic);
    }
    orderBox.append(wanted, bar, buttons);
    root.append(orderBox);
  }

  const result = el('section', 'contest-result');
  result.hidden = true;
  result.dataset.testid = 'contest-result';
  root.append(result);
  document.body.append(root);

  let flashTimer = 0;
  let seen = 0;
  const say = (text: string): void => {
    flash.textContent = text;
    flash.classList.add('on');
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => flash.classList.remove('on'), 900);
  };
  let shownResult = false;

  const showResult = (s: ContestSession, r: ContestResult): void => {
    shownResult = true;
    top.hidden = true;
    hint.hidden = true;
    orderBox.hidden = true;
    const unit = s.contestId === 'agility' ? ' s' : '';
    const board = [{ name: CONTEST.you, score: r.score, me: true }, ...r.rivals.map((v, i) => ({ name: CONTEST.rivals[i] ?? '?', score: v, me: false }))].sort((a, b) =>
      s.contestId === 'agility' ? a.score - b.score || Number(b.me) - Number(a.me) : b.score - a.score || Number(b.me) - Number(a.me),
    );
    const rows = board.map((b, i) => `<li class="${b.me ? 'me' : ''}"><span>${i + 1}</span><span>${b.me ? h.dogName() : b.name}</span><strong>${b.score.toFixed(s.contestId === 'agility' ? 1 : 0)}${unit}</strong></li>`).join('');
    const gains = !r.prize
      ? `<p class="hint">${CONTEST.noPrize}</p>`
      : r.place <= 3
        ? `<p class="gains">${ICONS.trophy}<strong>+${r.points}</strong> ${CONTEST.points} · ${ICONS.coin}<strong>+${r.coins}</strong> ${CONTEST.coins}</p>`
        : `<p class="gains">${CONTEST.consolation} <strong>+${r.points}</strong> ${CONTEST.points}</p>`;
    const up = r.classUp ? `<p class="class-up">${CONTEST.classUp.replace('{name}', h.dogName()).replace('{cls}', CLASS_NAMES[Math.min(4, r.contestClass + 1)] ?? '')}</p>` : '';
    result.innerHTML = `<h2>${CONTEST.resultTitle}</h2><p class="place" data-testid="contest-place">${CONTEST.place[r.place - 1] ?? ''}</p><ol class="board">${rows}</ol>${gains}${up}`;
    const back = btn(`${ICONS.home}<span>${CONTEST.back}</span>`, 'btn primary', 'contest-back');
    back.addEventListener('click', () => h.close());
    result.append(back);
    result.hidden = false;
  };

  return {
    update(s) {
      if (s.result) {
        if (!shownResult) showResult(s, s.result);
        return;
      }
      const run = s.run;
      if (run.kind === 'disc') {
        clock.textContent = fmt(run.timeLeftMs);
        score.textContent = `${CONTEST.score} ${run.score}`;
        if (run.catches.length > seen) {
          seen = run.catches.length;
          const c = run.catches[run.catches.length - 1];
          if (c) say(c.out ? CONTEST.out : `${c.air ? CONTEST.air : CONTEST.ground} +${c.points}`);
        }
      } else if (run.kind === 'agility') {
        clock.textContent = `${(run.timeMs / 1000).toFixed(1)} s`;
        score.textContent = run.penalties > 0 ? `${CONTEST.penalties} ${run.penalties}` : '';
        if (run.penalties > seen) {
          say(`+${(run.penalties - seen) * BALANCE.contests.agility.penaltyS} s`);
          seen = run.penalties;
        }
      } else {
        clock.textContent = `${Math.min(run.index + 1, run.orders.length)} / ${run.orders.length}`;
        score.textContent = `${CONTEST.score} ${run.score}`;
        const trick = run.orders[run.index];
        const label = h.tricks().find((t) => t.id === trick)?.label ?? '';
        wanted.textContent = run.waiting ? '' : `« ${label} »`;
        const k = run.waiting ? 0 : Math.max(0, 1 - run.elapsedMs / BALANCE.contests.obedience.orderMs);
        const fill = bar.firstElementChild;
        if (fill instanceof HTMLElement) fill.style.width = `${Math.round(k * 100)}%`;
        if (run.results.length > seen) {
          seen = run.results.length;
          const r = run.results[run.results.length - 1];
          say(r?.ok ? `+${r.points}` : CONTEST.wrongOrder);
        }
      }
    },
    destroy() {
      window.clearTimeout(flashTimer);
      root.remove();
    },
  };
}

