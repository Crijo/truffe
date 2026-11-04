/** D-77 : la saison du décor suit le calendrier français (dates de début fixes, heure locale). */
import { BALANCE } from '../data/balance';
import type { Season } from '../data/seasons';

export type { Season };

const DAY_MS = 86_400_000;

/** Mois (1–12) et jour du mois d'un nombre de jours depuis le 1er janvier 1970 (calendrier grégorien). */
function monthDay(days: number): { month: number; day: number } {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  return { month: mp < 10 ? mp + 3 : mp - 9, day: doy - Math.floor((153 * mp + 2) / 5) + 1 };
}

/** `tzOffsetMin` : valeur de `Date#getTimezoneOffset()` (UTC − local, en minutes). */
export function seasonAt(now: number, tzOffsetMin: number): Season {
  const { month, day } = monthDay(Math.floor((now - tzOffsetMin * 60_000) / DAY_MS));
  const md = month * 100 + day;
  const S = BALANCE.seasons.starts;
  if (md >= S.winter || md < S.spring) return 'winter';
  if (md < S.summer) return 'spring';
  if (md < S.autumn) return 'summer';
  return 'autumn';
}
