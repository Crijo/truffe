/**
 * Musique légère en boucle courte et ambiances discrètes, synthétisées avec Web Audio
 * (SPEC, Audio). Se règle et se coupe séparément des effets sonores.
 */

export type MusicScene = 'home' | 'outdoor' | 'contest';

/** Gamme pentatonique de do, sur deux octaves (Hz). */
const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];
/** Mélodies de 16 croches, en degrés de la gamme (−1 : silence). */
const TUNES: Record<MusicScene, number[][]> = {
  home: [
    [4, -1, 5, -1, 7, -1, 5, 4, 3, -1, 2, -1, 3, -1, -1, -1],
    [2, -1, 3, -1, 4, -1, 3, 2, 1, -1, 0, -1, 1, -1, -1, -1],
    [4, -1, 5, -1, 7, -1, 8, 7, 5, -1, 4, -1, 5, -1, -1, -1],
    [3, -1, 2, -1, 1, -1, 2, 3, 0, -1, -1, -1, -1, -1, -1, -1],
  ],
  outdoor: [
    [5, 7, -1, 8, 7, -1, 5, -1, 4, 5, -1, 7, 5, -1, -1, -1],
    [3, 4, -1, 5, 4, -1, 3, -1, 2, 3, -1, 4, 2, -1, -1, -1],
  ],
  contest: [
    [5, -1, 5, 7, 8, -1, 7, -1, 5, -1, 5, 7, 9, -1, 8, -1],
    [7, -1, 7, 5, 4, -1, 5, -1, 3, -1, 4, 5, 4, -1, -1, -1],
  ],
};
const BASS: Record<MusicScene, number[]> = { home: [0, 3, 0, 4], outdoor: [3, 1], contest: [0, 4] };
const TEMPO: Record<MusicScene, number> = { home: 84, outdoor: 96, contest: 112 };

export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private scene: MusicScene = 'home';
  private step = 0;
  private nextAt = 0;
  private timer = 0;

  constructor(private volume = 0.6) {}

  /** Démarre après un premier geste du joueur (règle des navigateurs). */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new window.AudioContext();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.level();
      this.out.connect(this.ctx.destination);
      this.nextAt = this.ctx.currentTime + 0.2;
      this.timer = window.setInterval(() => this.schedule(), 100);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private level(): number {
    return 0.16 * this.volume;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.2);
  }

  setScene(scene: MusicScene): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.step = 0;
  }

  /** Planifie les notes des 300 prochaines millisecondes. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.volume <= 0) {
      this.nextAt = ctx.currentTime + 0.1;
      return;
    }
    const eighth = 30 / TEMPO[this.scene];
    while (this.nextAt < ctx.currentTime + 0.3) {
      const tune = TUNES[this.scene];
      const bar = Math.floor(this.step / 16) % tune.length;
      const i = this.step % 16;
      const deg = tune[bar]?.[i] ?? -1;
      if (deg >= 0) this.pluck(this.nextAt, SCALE[deg] ?? 440, eighth * 1.6, 0.5);
      if (i % 8 === 0) {
        const b = BASS[this.scene];
        this.pluck(this.nextAt, (SCALE[b[(bar * 2 + i / 8) % b.length] ?? 0] ?? 261.6) / 2, eighth * 6, 0.35, 'sine');
      }
      // Dehors : un oiseau de temps en temps.
      if (this.scene !== 'home' && i === 0 && Math.random() < 0.35) this.chirp(this.nextAt + eighth * (2 + Math.random() * 8));
      this.nextAt += eighth;
      this.step++;
    }
  }

  private pluck(t: number, freq: number, dur: number, gain: number, shape: OscillatorType = 'triangle'): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const osc = ctx.createOscillator();
    osc.type = shape;
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Gazouillis : deux glissandos aigus très brefs. */
  private chirp(t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    for (let k = 0; k < 2; k++) {
      const at = t + k * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3200, at);
      osc.frequency.exponentialRampToValueAtTime(4400, at + 0.06);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.12, at + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
      osc.connect(env).connect(this.out);
      osc.start(at);
      osc.stop(at + 0.1);
    }
  }

  stop(): void {
    window.clearInterval(this.timer);
  }
}
