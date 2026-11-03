import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { PROFILES, simulate } from './typicalPlayer';

/** Palier de la race n° 7 (2 000 points). */
const RACE7 = BALANCE.unlocks.findIndex((t) => (t.breeds as readonly string[]).includes('husky'));

describe('Équilibrage : 30 jours de joueurs types', () => {
  const runs = PROFILES.map((p) => ({ p, runs: [1, 2, 3, 4, 5].map((seed) => simulate(p, 30, seed)) }));

  it('affiche le rythme des déblocages', () => {
    const lines = runs.map(({ p, runs: rs }) => {
      const days = BALANCE.unlocks.map((t, i) => {
        const ds = rs.map((r) => r.tierDay[i]).filter((d): d is number => d !== null);
        return `${t.at}: ${ds.length === rs.length ? `j${Math.min(...ds)}–${Math.max(...ds)}` : ds.length ? `j${Math.min(...ds)}+ (${ds.length}/${rs.length})` : '—'}`;
      });
      return `${p.name.padEnd(22)} ${days.join(' | ')}  (30 j : ${Math.round(rs.reduce((a, r) => a + (r.points[29] ?? 0), 0) / rs.length)} pts)`;
    });
    // `npm run balance` affiche ce tableau ; il est aussi écrit dans test-results/.
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/equilibrage.txt', `${lines.join('\n')}\n`);
    expect(lines).toHaveLength(PROFILES.length);
  });

  it('une session quotidienne de 15 minutes débloque la race n° 7 en 7 à 10 jours', () => {
    const daily = runs.find((r) => r.p.minutes === 15);
    for (const r of daily?.runs ?? []) {
      const d = r.tierDay[RACE7];
      expect(d).not.toBeNull();
      expect(d).toBeGreaterThanOrEqual(7);
      expect(d).toBeLessThanOrEqual(10);
    }
  });

  it('jouer plus va plus vite, sans tout débloquer en quelques jours', () => {
    const at = (min: number) => runs.find((r) => r.p.minutes === min)?.runs.map((r) => r.tierDay[RACE7] ?? 99) ?? [];
    expect(Math.max(...at(60))).toBeLessThanOrEqual(Math.min(...at(15)));
    expect(Math.min(...at(60))).toBeGreaterThanOrEqual(4);
    expect(Math.min(...at(5))).toBeGreaterThan(Math.max(...at(15)));
  });
});
