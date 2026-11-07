import { BALANCE } from '../data/balance';
import { SAVE_VERSION, type SaveGame } from '../sim/state';

export class SaveError extends Error {}

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Sexe stable tiré de l'identifiant, pour les chiens créés avant le jalon 3. */
function sexFromId(id: unknown): 'f' | 'm' {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 === 0 ? 'f' : 'm';
}

/** Une migration fait passer une sauvegarde de la version n à n + 1. */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  // v1 → v2 (jalon 3) : sexe, tempérament visible, objets familiers. Le chiot de départ était « joueur ».
  1: (raw) => ({
    ...raw,
    dogs: (Array.isArray(raw.dogs) ? raw.dogs : []).map((d: unknown) =>
      isObj(d) ? { sex: sexFromId(d.id), temperament: 'joueur', familiar: {}, ...d } : d,
    ),
  }),
  // v2 → v3 (jalon 5) : promenades, lieux visités ; pièces de bienvenue (D-49).
  2: (raw) => ({
    ...raw,
    coins: (isNum(raw.coins) ? raw.coins : 0) + BALANCE.economy.welcomeCoins,
    dogs: (Array.isArray(raw.dogs) ? raw.dogs : []).map((d: unknown) =>
      isObj(d) ? { walks: { lastRewardedAt: null, count: 0 }, visited: { park: false, gym: false, market: false }, ...d } : d,
    ),
  }),
  // v3 → v4 (jalon 6) : paliers de déblocage, décor du salon. Les paliers déjà atteints seront accordés au chargement.
  3: (raw) => ({
    unlockTier: 0,
    ...raw,
    settings: { decor: 'home', ...(isObj(raw.settings) ? raw.settings : {}) },
  }),
  // v4 → v5 : réglage de luminosité (D-72).
  4: (raw) => ({
    ...raw,
    settings: { brightness: BALANCE.display.defaultBrightness, ...(isObj(raw.settings) ? raw.settings : {}) },
  }),
  // v5 → v6 : besoins dans la maison (D-74).
  5: (raw) => ({
    poops: [],
    ...raw,
    dogs: (Array.isArray(raw.dogs) ? raw.dogs : []).map((d: unknown) => (isObj(d) ? { lastReliefAt: isNum(raw.lastSeenAt) ? raw.lastSeenAt : 0, ...d } : d)),
  }),
  // v6 → v7 : niveaux (D-78). L'XP de départ reprend les points de maître, partagés entre les chiots.
  6: (raw) => {
    const pts = isNum(raw.masterPoints) ? raw.masterPoints : 0;
    const dogs: unknown[] = Array.isArray(raw.dogs) ? raw.dogs : [];
    const each = dogs.length > 0 ? Math.round(pts / dogs.length) : 0;
    return { xp: pts, ...raw, dogs: dogs.map((d) => (isObj(d) ? { xp: each, ...d } : d)) };
  },
  // v9 → v10 : croquettes à acheter (D-97) : chacun reçoit le stock de départ.
  9: (raw) => {
    const inv = isObj(raw.inventory) ? raw.inventory : {};
    // D-98 : jardin, pas encore de tas.
    return { garden: { dayKey: '', spots: [] }, ...raw, inventory: { [BALANCE.kibble.itemId]: BALANCE.kibble.start, ...inv } };
  },
  // v8 → v9 : salon qui se salit (D-91) : propre au départ.
  8: (raw) => ({ dirt: [], dirtClockAt: isNum(raw.lastSeenAt) ? raw.lastSeenAt : 0, ...raw }),
  // v7 → v8 : amusement (D-82).
  7: (raw) => ({
    ...raw,
    dogs: (Array.isArray(raw.dogs) ? raw.dogs : []).map((d: unknown) => (isObj(d) && isObj(d.needs) ? { ...d, needs: { fun: BALANCE.start.fun, ...d.needs } } : d)),
  }),
};
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
