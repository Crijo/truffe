import { describe, expect, it } from 'vitest';
import { createStepDetector } from '../../src/input/pedometer';

const G = 9.81;

/** Téléphone tenu en main : pesanteur + rebond à chaque pas (cadence en pas par seconde), un peu de bruit. */
function walkSignal(seconds: number, cadence: number, amp: number): { t: number; z: number }[] {
  const out: { t: number; z: number }[] = [];
  let noise = 1;
  for (let t = 0; t < seconds * 1000; t += 16) {
    noise = (noise * 16807) % 2147483647;
    const n = ((noise / 2147483647) - 0.5) * 0.4;
    const phase = ((t / 1000) * cadence) % 1;
    const bump = phase < 0.25 ? Math.sin((phase / 0.25) * Math.PI) * amp : -0.25 * amp * Math.sin(((phase - 0.25) / 0.75) * Math.PI);
    out.push({ t, z: G + bump + n });
  }
  return out;
}
const count = (sig: { t: number; z: number }[]): number => {
  const d = createStepDetector();
  return sig.reduce((a, s) => a + (d.push(0.3, 0.2, s.z, s.t) ? 1 : 0), 0);
};

describe('D-81 : compteur de pas', () => {
  it('marche normale (2 pas par seconde) : environ le bon nombre de pas', () => {
    const n = count(walkSignal(30, 2, 3));
    expect(n).toBeGreaterThanOrEqual(55);
    expect(n).toBeLessThanOrEqual(62);
  });

  it('marche rapide (2,8 pas par seconde) aussi', () => {
    const n = count(walkSignal(20, 2.8, 3.5));
    expect(n).toBeGreaterThanOrEqual(52);
    expect(n).toBeLessThanOrEqual(58);
  });

  it('téléphone posé ou tenu immobile : aucun pas', () => {
    expect(count(walkSignal(30, 2, 0))).toBe(0);
  });

  it('une secousse brève ne compte qu’un pas', () => {
    const d = createStepDetector();
    let n = 0;
    for (let t = 0; t < 2000; t += 16) n += d.push(0, 0, G, t) ? 1 : 0;
    for (let t = 2000; t < 2100; t += 16) n += d.push(0, 0, G + 8, t) ? 1 : 0;
    for (let t = 2100; t < 4000; t += 16) n += d.push(0, 0, G, t) ? 1 : 0;
    expect(n).toBe(1);
  });
});
