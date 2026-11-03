import { BALANCE } from '../data/balance';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * Identifiant du jour de jeu, qui commence à 4 h du matin heure locale.
 * `tzOffsetMin` est la valeur de `Date#getTimezoneOffset()` (UTC − local, en minutes).
 */
export function dayKeyAt(now: number, tzOffsetMin: number): string {
  const local = now - tzOffsetMin * 60_000;
  return String(Math.floor((local - BALANCE.time.dayResetHour * HOUR_MS) / DAY_MS));
}
