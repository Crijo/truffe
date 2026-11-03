/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { dtw } from '../../src/input/voice/dtw';
import { closestOther, recognize, type VoiceCommand } from '../../src/input/voice/matcher';
import { features, mfcc, trimSilence } from '../../src/input/voice/mfcc';

const SR = 16000;
const DIR = join(__dirname, '..', 'fixtures', 'voice');

/** Lit un WAV PCM 16 bits mono. */
function wav(name: string): Float32Array {
  const buf = readFileSync(join(DIR, `${name}.wav`));
  let off = 12;
  while (off < buf.length - 8) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      const n = size / 2;
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(off + 8 + i * 2) / 32768;
      return out;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error(`pas de données dans ${name}`);
}

/** Variations d'un enregistrement : volume, bruit, voix plus aiguë ou plus grave. */
function vary(x: Float32Array, kind: number, seed: number): Float32Array {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32) * 2 - 1;
  if (kind === 0) return x.map((v) => v * 0.4);
  if (kind === 1) {
    let p = 0;
    for (const v of x) p += v * v;
    const noise = Math.sqrt(p / x.length) * 0.06;
    return x.map((v) => v + rnd() * noise);
  }
  // Rééchantillonnage : ±5 % de hauteur et de débit.
  const k = kind === 2 ? 1.05 : 0.95;
  const n = Math.floor(x.length / k);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i * k;
    const i0 = Math.floor(t);
    const f = t - i0;
    out[i] = (x[i0] ?? 0) * (1 - f) + (x[i0 + 1] ?? 0) * f;
  }
  return out;
}

const feat = (x: Float32Array): number[][] => {
  const f = features(x, SR);
  if (!f) throw new Error('aucune parole');
  return f;
};

describe('MFCC (13 coefficients, fenêtres de 25 ms, pas de 10 ms)', () => {
  it('une seconde de signal donne ~98 trames de 13 coefficients', () => {
    const x = new Float32Array(SR).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / SR));
    const m = mfcc(x, SR);
    expect(m.length).toBeGreaterThanOrEqual(96);
    expect(m.length).toBeLessThanOrEqual(100);
    expect(m[0]).toHaveLength(BALANCE.voice.coeffs);
    expect(m.flat().every(Number.isFinite)).toBe(true);
  });

  it('deux sons différents donnent des coefficients différents', () => {
    const a = mfcc(new Float32Array(SR / 2).map((_, i) => Math.sin((2 * Math.PI * 300 * i) / SR)), SR);
    const b = mfcc(new Float32Array(SR / 2).map((_, i) => Math.sin((2 * Math.PI * 2500 * i) / SR)), SR);
    expect(dtw(a, b)).toBeGreaterThan(dtw(a, a) + 1);
  });
});

describe('Détection de la parole', () => {
  it('retire le silence avant et après', () => {
    const x = wav('assis-h0');
    const t = trimSilence(x, SR);
    expect(t).not.toBeNull();
    expect(t?.length ?? 0).toBeLessThan(x.length * 0.9);
    expect(t?.length ?? 0).toBeGreaterThan(SR * 0.15);
  });

  it('le silence seul n’est pas de la parole', () => {
    const quiet = new Float32Array(SR).map((_, i) => Math.sin(i) * 0.0005);
    expect(trimSilence(quiet, SR)).toBeNull();
    expect(features(new Float32Array(SR), SR)).toBeNull();
  });
});

describe('DTW normalisée par la longueur', () => {
  it('vaut 0 pour deux suites identiques et supporte des longueurs différentes', () => {
    const a = feat(wav('patte-h0'));
    expect(dtw(a, a)).toBeCloseTo(0, 6);
    const slow = feat(wav('patte-hm2'));
    expect(slow.length).not.toBe(a.length);
    expect(dtw(a, slow)).toBeLessThan(dtw(a, feat(wav('debout-h0'))));
  });
});

describe('Reconnaissance (critère : ≥ 80 % sur 5 ordres et 20 essais)', () => {
  const ORDERS = ['assis', 'couche', 'patte', 'tourne', 'debout'];
  const commands: VoiceCommand[] = ORDERS.map((id) => ({ id, templates: ['h0', 'hm1', 'hp1'].map((t) => feat(wav(`${id}-${t}`))) }));

  it('reconnaît au moins 80 % des essais', () => {
    let ok = 0;
    let total = 0;
    const misses: string[] = [];
    for (const id of ORDERS) {
      let trial = 0;
      for (const take of ['hm2', 'hp2', 'hm3', 'hp3']) {
        for (let v = 0; v < 5; v++) {
          const x = v === 4 ? wav(`${id}-${take}`) : vary(wav(`${id}-${take}`), v, ++trial);
          const r = recognize(feat(x), commands);
          total++;
          if (r?.id === id) ok++;
          else misses.push(`${id}/${take}/${v}→${r?.id ?? '?'}`);
        }
      }
    }
    expect(total).toBe(100);
    expect(ok / total, misses.join(' ')).toBeGreaterThanOrEqual(0.8);
  });

  it('un mot inconnu donne le plus souvent le « ? » rouge', () => {
    let rejected = 0;
    for (const take of ['h0', 'hm1', 'hp1', 'hm2', 'hp2', 'hm3', 'hp3']) if (recognize(feat(wav(`inconnu-${take}`)), commands) === null) rejected++;
    expect(rejected).toBeGreaterThanOrEqual(5);
  });

  it('un ordre trop proche d’un autre est signalé (« ? » bleu)', () => {
    const others = commands.filter((c) => c.id !== 'tourne');
    const asAnother: VoiceCommand[] = [...others, { id: 'tourne-bis', templates: [feat(wav('tourne-h0'))] }];
    const close = closestOther(feat(wav('tourne-hp1')), asAnother, 'nouveau');
    expect(close?.id).toBe('tourne-bis');
    expect(close?.distance ?? Infinity).toBeLessThan(BALANCE.voice.similarBelow);
    const far = closestOther(feat(wav('nom-h0')), others, 'nom');
    expect(far === null || far.distance >= BALANCE.voice.similarBelow).toBe(true);
  });

  it('répond en moins de 300 ms après la fin de la parole', () => {
    const many: VoiceCommand[] = [...commands, ...commands.map((c) => ({ ...c, id: `${c.id}2` }))].map((c) => ({ ...c, templates: [...c.templates, ...c.templates].slice(0, 5) }));
    const x = wav('debout-hp2');
    const t0 = performance.now();
    recognize(feat(x), many);
    expect(performance.now() - t0).toBeLessThan(300);
  });
});
