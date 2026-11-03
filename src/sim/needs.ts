/** Jauges du chiot (SPEC, Jauges) et leur traduction en niveaux. */
import { BALANCE } from '../data/balance';
import type { NeedKind, NeedLevel } from '../data/strings';
import type { Dog } from './state';

export type Needs = Dog['needs'];
export type { NeedKind, NeedLevel };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const clamp100 = (v: number): number => Math.min(100, Math.max(0, v));

/** Évolution en jeu sur `dtMs`. */
export function tickNeeds(n: Needs, dtMs: number, asleep: boolean): Needs {
  const h = dtMs / HOUR;
  const r = BALANCE.needs.perHour;
  return {
    hunger: clamp100(n.hunger - r.hunger * h),
    thirst: clamp100(n.thirst - r.thirst * h),
    cleanliness: clamp100(n.cleanliness - r.cleanliness * h),
    energy: clamp100(n.energy + (asleep ? r.energyAsleep : -r.energyAwake) * h),
  };
}

export function needLevel(kind: NeedKind, v: number): NeedLevel {
  const [a, b, c] = BALANCE.needs.words[kind];
  if (v >= a) return 'excellent';
  if (v >= b) return 'normal';
  if (v >= c) return 'watch';
  return 'urgent';
}

export const NEED_KINDS: readonly NeedKind[] = ['hunger', 'thirst', 'cleanliness'];

export function isUrgent(n: Pick<Needs, NeedKind>): boolean {
  return NEED_KINDS.some((k) => needLevel(k, n[k]) === 'urgent');
}

/** Heure locale décimale (0 à 24). */
export function localHour(now: number, tzOffsetMin: number): number {
  const local = now - tzOffsetMin * 60_000;
  return (((local % DAY) + DAY) % DAY) / HOUR;
}

/** F-VIE-1 et D-10 : nuit de 22 h à 7 h. */
export function isNight(now: number, tzOffsetMin: number): boolean {
  const h = localHour(now, tzOffsetMin);
  const S = BALANCE.sleep;
  return h >= S.nightStartHour || h < S.nightEndHour;
}

/** D-72 : opacité du voile de nuit, selon la part de nuit (0 à 1) et la luminosité choisie (0 à 1). */
export function nightAlpha(night: number, brightness: number): number {
  const b = Math.min(1, Math.max(0, brightness));
  return BALANCE.display.nightMaxAlpha * Math.min(1, Math.max(0, night)) * (1 - b);
}
