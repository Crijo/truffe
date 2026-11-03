/**
 * Export et import de la sauvegarde (SPEC, Pile technique : « export JSON »).
 * Le fichier contient la partie et les empreintes vocales, jamais d'enregistrement sonore.
 */
import type { SaveGame } from '../sim/state';
import { migrate, SaveError } from './migrations';

const FORMAT = 'truffe-sauvegarde';

export function exportSave(save: SaveGame, now: number): string {
  return JSON.stringify({ format: FORMAT, exportedAt: now, save });
}

/** Lit un fichier exporté et l'amène à la version courante, ou lève SaveError. */
export function importSave(text: string): SaveGame {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveError('fichier illisible');
  }
  if (typeof data !== 'object' || data === null || (data as { format?: unknown }).format !== FORMAT) throw new SaveError('ce n’est pas une sauvegarde de Truffe');
  return migrate((data as { save?: unknown }).save);
}

export function exportFileName(now: number): string {
  return `truffe-sauvegarde-${new Date(now).toISOString().slice(0, 10)}.json`;
}
