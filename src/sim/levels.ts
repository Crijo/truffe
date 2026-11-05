/**
 * D-78 : niveaux. Le joueur et chaque chiot gagnent de l'XP : un tout petit peu pour les soins
 * (plafonné par jour et par chiot), davantage pour les activités et le dressage.
 */
import { BALANCE } from '../data/balance';
import { amuse } from './needs';
import type { DogId, SaveGame } from './state';

const L = BALANCE.levels;
export type XpSource = keyof typeof L.player;

/** Sources « soins du quotidien », plafonnées par jour (ménage compris). */
const CARE: ReadonlySet<XpSource> = new Set<XpSource>(['meal', 'water', 'groom', 'caress', 'poop', 'toy', 'chores']);

/** XP à gagner pour passer du niveau `level` au suivant. */
export function xpToNext(level: number): number {
  return L.curve.base + L.curve.step * (level - 1);
}

/** Niveau atteint avec cette XP, XP dans le niveau et XP qu'il demande. */
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = Math.max(0, Math.floor(xp));
  while (level < L.maxLevel && left >= xpToNext(level)) {
    left -= xpToNext(level);
    level++;
  }
  return { level, into: left, need: xpToNext(level) };
}

/**
 * Donne l'XP de `n` fois cette source : au joueur selon sa table, au chiot selon la sienne (D-87).
 * Les soins sont plafonnés par jour et par chiot, séparément pour le joueur et pour le chiot.
 * Un niveau du joueur rapporte des pièces.
 */
export function awardXp(save: SaveGame, dogId: DogId, source: XpSource, n = 1): SaveGame {
  // D-82 : ce qui rapporte de l'XP amuse aussi le chiot (même au-delà du plafond des soins).
  const fun: Partial<Record<XpSource, number>> = BALANCE.needs.fun.gain;
  save = amuse(save, dogId, (fun[source] ?? 0) * n);
  let forPlayer = L.player[source] * n;
  let forDog = L.dog[source] * n;
  if (forPlayer <= 0 && forDog <= 0) return save;
  let day = save.day;
  if (CARE.has(source)) {
    const counters = save.day.perDog[dogId] ?? { masterPoints: 0, caresses: 0, newTricks: 0, prizeContests: 0 };
    const usedP = counters.careXp ?? 0;
    const usedD = counters.dogCareXp ?? 0;
    forPlayer = Math.max(0, Math.min(forPlayer, L.dailyCareXp - usedP));
    forDog = Math.max(0, Math.min(forDog, L.dailyCareXp - usedD));
    if (forPlayer === 0 && forDog === 0) return save;
    day = { ...day, perDog: { ...day.perDog, [dogId]: { ...counters, careXp: usedP + forPlayer, dogCareXp: usedD + forDog } } };
  }
  const before = levelOf(save.xp).level;
  const xp = save.xp + forPlayer;
  const after = levelOf(xp).level;
  let coins = save.coins;
  for (let lv = before + 1; lv <= after; lv++) coins += L.playerLevelCoins * lv;
  return { ...save, xp, coins, day, dogs: forDog > 0 ? save.dogs.map((d) => (d.id === dogId ? { ...d, xp: d.xp + forDog } : d)) : save.dogs };
}
