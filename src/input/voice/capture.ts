/**
 * Capture du micro, sur l'appareil seulement (SPEC : aucun son ne quitte l'appareil).
 * Le son n'est jamais conservé : seule l'empreinte calculée par `features` l'est.
 */
import { BALANCE } from '../../data/balance';

export class VoiceCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private chunks: Float32Array[] = [];
  private recording = false;
  private stopTimer = 0;

  /** Micro disponible : navigateur compatible et page sécurisée (HTTPS ou localhost). */
  static supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
  }

  /** Ouvre le micro (le navigateur demande l'autorisation la première fois). */
  async open(): Promise<boolean> {
    if (this.ctx && this.stream) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      return false;
    }
    const Ctor = window.AudioContext;
    this.ctx = new Ctor();
    const src = this.ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor suffit ici : il ne sert qu'à copier quelques secondes d'échantillons.
    const proc = this.ctx.createScriptProcessor(4096, 1, 1);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    proc.onaudioprocess = (e) => {
      if (this.recording) this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    src.connect(proc).connect(mute).connect(this.ctx.destination);
    return true;
  }

  start(onAutoStop: () => void): void {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.chunks = [];
    this.recording = true;
    window.clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(onAutoStop, BALANCE.voice.maxMs);
  }

  /** Arrête et renvoie les échantillons enregistrés. */
  stop(): { samples: Float32Array; sampleRate: number } | null {
    window.clearTimeout(this.stopTimer);
    if (!this.ctx || !this.recording) return null;
    this.recording = false;
    const n = this.chunks.reduce((s, c) => s + c.length, 0);
    const samples = new Float32Array(n);
    let off = 0;
    for (const c of this.chunks) {
      samples.set(c, off);
      off += c.length;
    }
    this.chunks = [];
    return { samples, sampleRate: this.ctx.sampleRate };
  }

  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.ctx = null;
  }
}
