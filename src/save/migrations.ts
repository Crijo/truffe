import { SAVE_VERSION, type SaveGame } from '../sim/state';

export class SaveError extends Error {}

type Raw = Record<string, unknown>;

/** Une migration fait passer une sauvegarde de la version n à n + 1. */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {};

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validate(raw: Raw): SaveGame {
  const numbers = ['createdAt', 'lastSeenAt', 'coins', 'masterPoints', 'rngState'];
  for (const k of numbers) if (!isNum(raw[k])) throw new SaveError(`champ ${k} invalide`);
  if (!Array.isArray(raw.dogs) || !Array.isArray(raw.homeDogIds)) throw new SaveError('chiens invalides');
  for (const k of ['inventory', 'discovered', 'day', 'settings', 'stats']) {
    if (!isObj(raw[k])) throw new SaveError(`champ ${k} invalide`);
  }
  return raw as unknown as SaveGame;
}

/** Amène une sauvegarde brute à la version courante, ou lève SaveError. */
export function migrate(input: unknown): SaveGame {
  if (!isObj(input)) throw new SaveError('sauvegarde illisible');
  let raw = input;
  let v = raw.version;
  if (!isNum(v) || v < 1 || v > SAVE_VERSION) throw new SaveError(`version ${String(v)} inconnue`);
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new SaveError(`migration ${v} absente`);
    raw = { ...step(raw), version: v + 1 };
    v += 1;
  }
  return validate(raw);
}
