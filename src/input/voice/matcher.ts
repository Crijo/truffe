/** Choix de l'ordre reconnu (SPEC, étapes 3 à 5). */
import { BALANCE } from '../../data/balance';
import { dtw } from './dtw';

export interface VoiceCommand {
  id: string;
  templates: readonly (readonly (readonly number[])[])[];
}

const V = BALANCE.voice;

function best(f: readonly (readonly number[])[], c: VoiceCommand): number {
  let d = Infinity;
  for (const t of c.templates) d = Math.min(d, dtw(f, t));
  return d;
}

/**
 * Le meilleur ordre, s'il passe sous le seuil de confiance et s'il est nettement
 * meilleur que le deuxième ; sinon null (point d'interrogation rouge).
 */
export function recognize(f: readonly (readonly number[])[], commands: readonly VoiceCommand[]): { id: string; distance: number } | null {
  const scored = commands
    .filter((c) => c.templates.length > 0)
    .map((c) => ({ id: c.id, d: best(f, c) }))
    .sort((a, b) => a.d - b.d);
  const first = scored[0];
  if (!first || first.d > V.acceptBelow) return null;
  const second = scored[1];
  if (second && first.d / second.d > V.marginRatio) return null;
  return { id: first.id, distance: first.d };
}

/** L'ordre existant le plus proche d'un nouvel enregistrement (point d'interrogation bleu). */
export function closestOther(f: readonly (readonly number[])[], commands: readonly VoiceCommand[], exclude: string): { id: string; distance: number } | null {
  let out: { id: string; distance: number } | null = null;
  for (const c of commands) {
    if (c.id === exclude || c.templates.length === 0) continue;
    const d = best(f, c);
    if (!out || d < out.distance) out = { id: c.id, distance: d };
  }
  return out;
}
