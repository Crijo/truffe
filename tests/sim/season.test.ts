import { describe, expect, it } from 'vitest';
import { seasonAt } from '../../src/sim/season';

const PARIS_HIVER = -60;
const PARIS_ETE = -120;
const at = (y: number, m: number, d: number, h = 12): number => Date.UTC(y, m - 1, d, h);

describe('D-77 : la saison suit le calendrier français', () => {
  it('les quatre saisons, avec leurs dates de début', () => {
    expect(seasonAt(at(2026, 11, 4), PARIS_HIVER)).toBe('autumn');
    expect(seasonAt(at(2026, 1, 15), PARIS_HIVER)).toBe('winter');
    expect(seasonAt(at(2026, 4, 10), PARIS_ETE)).toBe('spring');
    expect(seasonAt(at(2026, 7, 14), PARIS_ETE)).toBe('summer');
  });

  it('change le jour même, à minuit heure locale', () => {
    expect(seasonAt(at(2026, 3, 19, 12), PARIS_HIVER)).toBe('winter');
    expect(seasonAt(at(2026, 3, 20, 0), PARIS_HIVER)).toBe('spring');
    expect(seasonAt(at(2026, 6, 20, 21), PARIS_ETE)).toBe('spring');
    expect(seasonAt(at(2026, 6, 21, 12), PARIS_ETE)).toBe('summer');
    expect(seasonAt(at(2026, 9, 21, 12), PARIS_ETE)).toBe('summer');
    expect(seasonAt(at(2026, 9, 22, 12), PARIS_ETE)).toBe('autumn');
    expect(seasonAt(at(2026, 12, 20, 12), PARIS_HIVER)).toBe('autumn');
    // 20 décembre, 23 h 30 UTC = 21 décembre, 0 h 30 à Paris.
    expect(seasonAt(Date.UTC(2026, 11, 20, 23, 30), PARIS_HIVER)).toBe('winter');
    expect(seasonAt(at(2026, 12, 31), PARIS_HIVER)).toBe('winter');
  });

  it('chaque jour de 2024 à 2030 (années bissextiles comprises) donne la saison du calendrier', () => {
    const ref = (t: number): string => {
      const d = new Date(t);
      const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
      return md >= 1221 || md < 320 ? 'winter' : md < 621 ? 'spring' : md < 922 ? 'summer' : 'autumn';
    };
    for (let t = Date.UTC(2024, 0, 1, 12); t < Date.UTC(2031, 0, 1); t += 86_400_000) expect(seasonAt(t, 0)).toBe(ref(t));
  });
});
