/**
 * D-81 : compteur de pas, à partir de l'accéléromètre (événement `devicemotion`).
 * Un pas est un pic de l'accélération au-dessus de sa moyenne (la pesanteur), espacé du précédent.
 */
import { BALANCE } from '../data/balance';

const D = BALANCE.walk.steps.detector;

export interface StepDetector {
  /** Une mesure (m/s², pesanteur comprise) à l'instant `t` (ms) ; renvoie true si un pas vient d'être fait. */
  push(ax: number, ay: number, az: number, t: number): boolean;
}

export function createStepDetector(): StepDetector {
  let base: number | null = null;
  let armed = true;
  let lastStep = -Infinity;
  return {
    push(ax, ay, az, t) {
      const m = Math.hypot(ax, ay, az);
      base = base === null ? m : base + (m - base) * D.smoothing;
      const d = m - base;
      if (!armed) {
        if (d < D.rearm) armed = true;
        return false;
      }
      if (d >= D.threshold && t - lastStep >= D.minIntervalMs) {
        armed = false;
        lastStep = t;
        return true;
      }
      return false;
    },
  };
}

type MotionCtor = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Écoute les pas tant que `stop` n'est pas appelé. Sur iPhone, l'autorisation est demandée
 * (à appeler pendant un geste du joueur). Renvoie null si l'appareil ne donne pas ses mouvements.
 */
export async function listenSteps(onStep: () => void): Promise<{ stop(): void } | null> {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return null;
  const ctor = (window as unknown as { DeviceMotionEvent: MotionCtor }).DeviceMotionEvent;
  if (typeof ctor.requestPermission === 'function') {
    try {
      if ((await ctor.requestPermission()) !== 'granted') return null;
    } catch {
      return null;
    }
  }
  const det = createStepDetector();
  const on = (e: DeviceMotionEvent): void => {
    const a = e.accelerationIncludingGravity;
    if (a?.x == null || a.y == null || a.z == null) return;
    if (det.push(a.x, a.y, a.z, e.timeStamp)) onStep();
  };
  window.addEventListener('devicemotion', on);
  return { stop: () => window.removeEventListener('devicemotion', on) };
}
