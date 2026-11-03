/**
 * Sons du chiot, synthétisés avec Web Audio (aucun fichier : voir ASSETS.md).
 * Le contexte audio ne démarre qu'après un premier geste du joueur.
 */
import type { PuppyEventType } from '../sim/behavior';

type Shape = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastAt = new Map<string, number>();

  constructor(private volume = 0.8) {}

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext;
      this.ctx = new Ctor();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.55 * this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      this.out.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.out) this.out.gain.value = 0.55 * v;
  }

  play(type: PuppyEventType): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    // Évite d'empiler deux fois le même son au même instant.
    const prev = this.lastAt.get(type) ?? 0;
    if (ctx.currentTime - prev < 0.08) return;
    this.lastAt.set(type, ctx.currentTime);
    const t = ctx.currentTime + 0.005;
    const v = 0.8 + Math.random() * 0.4;
    switch (type) {
      case 'bark':
        this.voice(t, [660 * v, 360 * v], 0.16, 'sawtooth', 0.5, 1000);
        this.burst(t, 0.05, 1600, 2, 0.35);
        break;
      case 'yip':
        this.voice(t, [980 * v, 760 * v], 0.1, 'triangle', 0.45, 1800);
        break;
      case 'yelp':
        this.voice(t, [1250 * v, 620 * v], 0.2, 'triangle', 0.5, 2000);
        break;
      case 'whine':
        this.voice(t, [700 * v, 1020 * v, 820 * v], 0.9, 'sine', 0.22, 1600, 7);
        break;
      case 'howl':
        this.voice(t, [460 * v, 720 * v, 700 * v, 520 * v], 1.8, 'triangle', 0.28, 1300, 5);
        break;
      case 'yawn':
        this.voice(t, [420, 300, 240], 1.1, 'sawtooth', 0.16, 900);
        this.voice(t + 1.05, [900, 1200], 0.12, 'sine', 0.12, 2000);
        break;
      case 'sniff':
        for (let i = 0; i < 3; i++) this.burst(t + i * 0.11, 0.06, 2800, 0.8, 0.3);
        break;
      case 'sniffGround':
        for (let i = 0; i < 6; i++) this.burst(t + i * 0.13, 0.06, 2600, 0.8, 0.25);
        break;
      case 'lick':
        this.burst(t, 0.04, 3200, 1.2, 0.35);
        this.voice(t + 0.03, [420, 200], 0.04, 'sine', 0.25, 3000);
        break;
      case 'shake':
        this.flutter(t, 0.75, 16, 1500, 0.4);
        break;
      case 'dig':
      case 'scratch':
        this.flutter(t, 1.6, type === 'dig' ? 9 : 14, 800, 0.22);
        break;
      case 'chew':
        this.burst(t, 0.05, 700, 1.5, 0.35);
        this.burst(t + 0.09, 0.04, 900, 1.5, 0.25);
        break;
      case 'lap':
        this.burst(t, 0.035, 2400, 1.4, 0.3);
        this.voice(t + 0.02, [500, 260], 0.035, 'sine', 0.18, 2500);
        break;
      case 'lickLips':
        this.burst(t, 0.04, 3000, 1.2, 0.3);
        this.burst(t + 0.15, 0.04, 3000, 1.2, 0.25);
        break;
      case 'pant':
        // Halètement : souffles rapides, alternés.
        for (let i = 0; i < 8; i++) this.burst(t + i * 0.17, 0.11, i % 2 ? 1500 : 1100, 0.9, 0.16);
        break;
      case 'snore':
        this.burst(t, 0.9, 380, 0.7, 0.12);
        break;
      case 'stretch':
        this.voice(t, [520, 760, 600], 0.6, 'sine', 0.16, 1500, 6);
        break;
      case 'bulb':
        this.voice(t, [1200, 1800], 0.18, 'sine', 0.12, 2400);
        break;
      case 'learned':
        this.voice(t, [980, 760], 0.1, 'triangle', 0.4, 1800);
        this.voice(t + 0.14, [1100, 820], 0.1, 'triangle', 0.4, 1800);
        this.voice(t + 0.3, [1400, 2100], 0.25, 'sine', 0.14, 2600);
        break;
      case 'progress':
      case 'givePaw':
      case 'beg':
        this.voice(t, [980 * v, 760 * v], 0.1, 'triangle', 0.35, 1800);
        break;
      case 'confused':
      case 'similar':
        this.voice(t, [700 * v, 900 * v, 640 * v], 0.45, 'sine', 0.2, 1500, 6);
        break;
      case 'roll':
      case 'flip':
      case 'dance':
      case 'handstand':
      case 'wiggle':
      case 'playBow':
      case 'jump':
        for (let i = 0; i < 3; i++) this.burst(t + i * 0.16, 0.09, 1200, 1.5, 0.16);
        break;
      default:
        break;
    }
  }

  /** Bruit d'outil de soin pendant le geste (limité à un toutes les 120 ms). */
  tool(kind: 'soap' | 'shower' | 'towel' | 'brush'): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const prev = this.lastAt.get(kind) ?? 0;
    if (ctx.currentTime - prev < 0.12) return;
    this.lastAt.set(kind, ctx.currentTime);
    const t = ctx.currentTime + 0.005;
    if (kind === 'soap') {
      this.burst(t, 0.06, 1800, 2, 0.18);
      if (Math.random() < 0.4) this.voice(t + 0.03, [900, 1500], 0.03, 'sine', 0.12, 2000);
    } else if (kind === 'shower') this.burst(t, 0.16, 4200, 0.6, 0.2);
    else if (kind === 'towel') this.burst(t, 0.12, 900, 0.7, 0.2);
    else this.burst(t, 0.08, 3800, 1.5, 0.14);
  }

  /** Voix tonale : glissando de fréquences, enveloppe, filtre « formant ». */
  private voice(t: number, freqs: number[], dur: number, shape: Shape, gain: number, formant: number, vibratoHz = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const osc = ctx.createOscillator();
    osc.type = shape;
    const f0 = freqs[0] ?? 440;
    osc.frequency.setValueAtTime(f0, t);
    freqs.slice(1).forEach((f, i) => osc.frequency.linearRampToValueAtTime(f, t + (dur * (i + 1)) / (freqs.length - 1)));
    if (vibratoHz > 0) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = vibratoHz;
      depth.gain.value = f0 * 0.025;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = formant;
    filter.Q.value = 1.2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
    env.gain.setValueAtTime(gain, t + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(env).connect(this.out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Souffle bref : nez, langue. */
  private burst(t: number, dur: number, freq: number, q: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(env).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** Bruit haché : ébrouement, grattage. */
  private flutter(t: number, dur: number, rate: number, cutoff: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const env = ctx.createGain();
    env.gain.value = 0;
    const steps = Math.floor(dur * rate);
    for (let i = 0; i < steps; i++) {
      const at = t + i / rate;
      const fade = 1 - i / steps;
      env.gain.setValueAtTime(gain * fade, at);
      env.gain.setValueAtTime(0.0001, at + 0.5 / rate);
    }
    src.connect(filter).connect(env).connect(this.out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
}
