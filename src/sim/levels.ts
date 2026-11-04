/**
 * D-78 : niveaux. Le joueur et chaque chiot gagnent de l'XP : un tout petit peu pour les soins
 * (plafonné par jour et par chiot), davantage pour les activités et le dressage.
 */
import { BALANCE } from '../data/balance';
import type { DogId, SaveGame } from './state';

const L = BALANCE.levels;
export type XpSource = keyof typeof L.xp;

/** Sources « soins du quotidien », plafonnées par jour. */
const CARE: ReadonlySet<XpSource> = new Set<XpSource>(['meal', 'water', 'groom', 'caress', 'poop', 'toy']);

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

/** Donne l'XP de `n` fois cette source au joueur et au chiot ; un niveau du joueur rapporte des pièces. */
export function awardXp(save: SaveGame, dogId: DogId, source: XpSource, n = 1): SaveGame {
  let amount = L.xp[source] * n;
  if (amount <= 0) return save;
  let day = save.day;
  if (CARE.has(source)) {
    const counters = save.day.perDog[dogId] ?? { masterPoints: 0, caresses: 0, newTricks: 0, prizeContests: 0 };
    const used = counters.careXp ?? 0;
    amount = Math.max(0, Math.min(amount, L.dailyCareXp - used));
    if (amount === 0) return save;
    day = { ...day, perDog: { ...day.perDog, [dogId]: { ...counters, careXp: used + amount } } };
  }
  const before = levelOf(save.xp).level;
  const xp = save.xp + amount;
  const after = levelOf(xp).level;
  let coins = save.coins;
  for (let lv = before + 1; lv <= after; lv++) coins += L.playerLevelCoins * lv;
  return { ...save, xp, coins, day, dogs: save.dogs.map((d) => (d.id === dogId ? { ...d, xp: d.xp + amount } : d)) };
}
