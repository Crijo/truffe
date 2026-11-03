import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recognize, type VoiceCommand } from '../../src/input/voice/matcher';
import { features } from '../../src/input/voice/mfcc';

/** Mot synthétique : voyelles et consonnes en suites de fréquences, ~1 s à 48 kHz. */
function word(seed: number, sr = 48_000): Float32Array {
  const x = new Float32Array(sr * 1.3);
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const start = Math.floor(sr * 0.15);
  const len = Math.floor(sr * 1);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = 180 + 120 * Math.sin(t * (3 + seed)) + 60 * Math.floor(t * 6);
    x[start + i] = 0.4 * Math.sin(2 * Math.PI * f * t) + 0.2 * Math.sin(2 * Math.PI * f * 2.7 * t) + 0.03 * (rnd() - 0.5);
  }
  return x;
}

describe('Reconnaissance vocale : réponse en moins de 300 ms (SPEC, Performance)', () => {
  it('14 ordres × 5 modèles et le nom : extraction + comparaison', () => {
    const commands: VoiceCommand[] = Array.from({ length: 15 }, (_, k) => ({ id: `o${k}`, templates: Array.from({ length: 5 }, (_, j) => features(word(k * 10 + j), 48_000) ?? []) }));
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const f = features(word(3), 48_000);
      if (f) recognize(f, commands);
      runs.push(performance.now() - t0);
    }
    const ms = Math.max(...runs.slice(1));
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/perf-voix.json', JSON.stringify({ worstMs: Math.round(ms), commands: 15, templates: 5 }));
    // Marge pour un téléphone 3 à 4 fois plus lent que l'ordinateur de développement.
    expect(ms).toBeLessThan(75);
  });
});
