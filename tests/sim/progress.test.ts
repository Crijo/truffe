import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { BREEDS, STARTER_BREEDS, UNLOCK_BREEDS } from '../../src/data/breeds';
import { migrate } from '../../src/save/migrations';
import { createNewGame, homeId, reduce, type GameState } from '../../src/sim/game';
import { createMind, tickMind, type PuppyContext } from '../../src/sim/behavior';
import { availableBreeds, availableDecors, grantUnlocks, itemLocked } from '../../src/sim/unlocks';
import { shopCatalog } from '../../src/sim/economy';
import { SAVE_VERSION, type Dog } from '../../src/sim/state';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 3, 13, 0);
const DAY = 24 * 3_600_000;
const C = BALANCE.care;
const G = BALANCE.gains;

const dog = (s: GameState, i = 0): Dog => {
  const d = s.save.dogs[i];
  if (!d) throw new Error('aucun chien');
  return d;
};
const withNeeds = (s: GameState, needs: Partial<Dog['needs']>): GameState => ({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, needs: { ...d.needs, ...needs } })) } });
function advance(s: GameState, ms: number): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
  return s;
}
function scrub(s: GameState, tool: 'soap' | 'shower' | 'dryer' | 'brush', px: number): GameState {
  for (let d = 0; d < px; d += 20) {
    s = reduce(s, { type: 'gesture', gesture: { kind: 'scrub', tool, distancePx: 20 } });
    s = advance(s, 20);
  }
  return s;
}
const rich = (s: GameState, coins = 50_000): GameState => ({ ...s, save: { ...s.save, coins } });
/** Adopte un chiot de plus (beagle). */
function adoptOne(s: GameState, name: string): GameState {
  s = reduce(rich(s, s.save.coins + 5000), { type: 'kennel/open', breedId: 'beagle' });
  return reduce(s, { type: 'adopt', index: 0, name, now: s.save.lastSeenAt, tzOffsetMin: TZ });
}

describe('F-ECO-1 : deux compteurs', () => {
  it('les points de maître ne se dépensent jamais', () => {
    let s = rich(startWithDog(T0, TZ));
    s = reduce(s, { type: 'debug/points', points: 150 });
    s = reduce(s, { type: 'shop/buy', itemId: 'bonnet' });
    expect(s.save.masterPoints).toBe(150);
    expect(s.save.coins).toBeLessThan(50_000);
  });
});

describe('F-ECO-2 : gains des soins et du dressage', () => {
  it('un repas avec un vrai besoin : +5', () => {
    let s = withNeeds(startWithDog(T0, TZ), { hunger: 30 });
    s = reduce(s, { type: 'care/bowl', kind: 'food', at: { x: 0.4, z: 0.7 } });
    s = advance(s, 9000);
    expect(s.bowls).toHaveLength(0);
    expect(s.save.masterPoints).toBe(G.meal);
  });

  it('de l’eau avec un vrai besoin : +5', () => {
    let s = withNeeds(startWithDog(T0, TZ), { thirst: 20 });
    s = reduce(s, { type: 'care/bowl', kind: 'water', at: { x: -0.3, z: 0.6 } });
    s = advance(s, 9000);
    expect(s.save.masterPoints).toBe(G.meal);
  });

  it('un bain avec un vrai besoin : +10 ; un bain d’un chiot déjà superbe : rien', () => {
    const bath = (cleanliness: number) => {
      let s = withNeeds(startWithDog(T0, TZ), { cleanliness });
      s = reduce(s, { type: 'gesture', gesture: { kind: 'groomStart' } });
      s = scrub(s, 'shower', C.wetPx);
      s = scrub(s, 'soap', C.soapPx);
      s = scrub(s, 'shower', C.rinsePx);
      s = scrub(s, 'dryer', C.dryPx);
      return s.save.masterPoints;
    };
    expect(bath(30)).toBe(G.groom);
    expect(bath(95)).toBe(0);
  });

  it('un brossage qui rend le pelage superbe : +10, une seule fois', () => {
    let s = withNeeds(startWithDog(T0, TZ), { cleanliness: 80 });
    s = scrub(s, 'brush', 3000);
    expect(dog(s).needs.cleanliness).toBeGreaterThanOrEqual(BALANCE.needs.realNeed.cleanliness);
    expect(s.save.masterPoints).toBe(G.groom);
    s = advance(s, C.brushSessionGapMs + 1000);
    s = scrub(s, 'brush', 3000);
    expect(s.save.masterPoints).toBe(G.groom);
  });

  it('un tour appris : +30 ; une répétition réussie d’un tour connu : +2', () => {
    let s = startWithDog(T0, TZ);
    const before = s.save.masterPoints;
    for (let i = 0; i < 10 && !dog(s).tricks.find((t) => t.trickId === 'sit')?.learned; i++) {
      s = reduce(s, { type: 'debug/spontaneous', trick: 'sit' });
      s = reduce(s, { type: 'train' });
      s = advance(s, 3000);
    }
    expect(dog(s).tricks.find((t) => t.trickId === 'sit')?.learned).toBe(true);
    expect(s.save.masterPoints - before).toBe(G.newTrick);
    // Un chiot très docile et attaché obéit presque toujours.
    s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, affection: 100, traits: { ...d.traits, docility: 1 } })) } };
    let ok = 0;
    for (let i = 0; i < 6; i++) {
      const p = s.save.masterPoints;
      s = reduce(s, { type: 'order', trickId: 'sit' });
      if (s.save.masterPoints === p + G.trickRepeat) ok++;
      s = advance(s, 61_000);
    }
    expect(ok).toBeGreaterThan(0);
  });

  it('plafond de 200 points par chiot et par jour, hors concours', () => {
    let s = startWithDog(T0, TZ);
    for (let i = 0; i < 30; i++) s = reduce(s, { type: 'debug/points', points: 10 });
    expect(s.save.masterPoints).toBe(BALANCE.economy.dailyPointsCap);
    s = reduce(s, { type: 'session/resume', now: s.save.lastSeenAt + DAY, tzOffsetMin: TZ });
    s = reduce(s, { type: 'debug/points', points: 10 });
    expect(s.save.masterPoints).toBe(BALANCE.economy.dailyPointsCap + 10);
  });
});

describe('Déblocages', () => {
  it('races : 6 au départ, puis n° 7 à 2 000, n° 8 à 10 000, n° 9 à 30 000 et la secrète à 50 000', () => {
    expect(availableBreeds(1999)).toEqual([...STARTER_BREEDS]);
    expect(availableBreeds(2000)).toEqual([...STARTER_BREEDS, 'husky']);
    expect(availableBreeds(10_000)).toEqual([...STARTER_BREEDS, 'husky', 'caniche']);
    expect(availableBreeds(30_000)).toEqual([...STARTER_BREEDS, 'husky', 'caniche', 'corgi']);
    expect(availableBreeds(50_000)).toEqual([...STARTER_BREEDS, ...UNLOCK_BREEDS]);
    for (const id of UNLOCK_BREEDS) expect(BREEDS[id]).toBeDefined();
  });

  it('décors : bord de mer à 6 000, espace à 18 000', () => {
    expect(availableDecors(5999)).toEqual(['home']);
    expect(availableDecors(6000)).toEqual(['home', 'seaside']);
    expect(availableDecors(18_000)).toEqual(['home', 'seaside', 'space']);
  });

  it('300 : la corde s’ouvre et le gros ballon arrive dans le sac', () => {
    expect(itemLocked('corde-noeuds', 299)).toBe(true);
    expect(itemLocked('corde-noeuds', 300)).toBe(false);
    let s = rich(startWithDog(T0, TZ));
    s = reduce(s, { type: 'shop/buy', itemId: 'corde-noeuds' });
    expect(s.save.inventory['corde-noeuds'] ?? 0).toBe(0);
    s = { ...s, save: { ...s.save, masterPoints: 290 } };
    s = reduce(s, { type: 'debug/points', points: 10 });
    expect(s.save.unlockTier).toBe(1);
    expect(s.save.inventory.ballon).toBe(1);
    s = reduce(s, { type: 'shop/buy', itemId: 'corde-noeuds' });
    expect(s.save.inventory['corde-noeuds']).toBe(1);
  });

  it('chaque palier n’est accordé qu’une fois, et plusieurs paliers d’un coup', () => {
    const save = { ...createNewGame(T0, 1), masterPoints: 12_000 };
    const once = grantUnlocks(save);
    expect(once.unlockTier).toBe(4);
    expect(once.inventory).toEqual({ ballon: 1, canape: 1, 'souris-meca': 1 });
    expect(grantUnlocks(once)).toBe(once);
  });

  it('les objets de déblocage ne se vendent ni en boutique ni à la brocante', () => {
    for (const id of ['ballon', 'canape', 'souris-meca']) expect(shopCatalog().some((i) => i.id === id)).toBe(false);
  });

  it('le chenil refuse une race encore verrouillée', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'kennel/open', breedId: 'husky' });
    expect(s.kennel).toBeNull();
    s = { ...s, save: { ...s.save, masterPoints: 2000 } };
    s = reduce(s, { type: 'kennel/open', breedId: 'husky' });
    expect(s.kennel?.breedId).toBe('husky');
  });

  it('choisir un décor débloqué', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'settings/decor', decor: 'seaside' });
    expect(s.save.settings.decor).toBe('home');
    s = { ...s, save: { ...s.save, masterPoints: 6000 } };
    s = reduce(s, { type: 'settings/decor', decor: 'seaside' });
    expect(s.save.settings.decor).toBe('seaside');
  });
});

describe('Plusieurs chiens : 3 à la maison, 5 à la pension, 8 au plus', () => {
  const family = (n: number): GameState => {
    let s = startWithDog(T0, TZ);
    for (let i = 1; i < n; i++) s = adoptOne(s, `Chiot${'abcdefgh'[i]}`);
    return s;
  };

  it('les 3 premiers vivent à la maison, les suivants vont à la pension', () => {
    const s = family(5);
    expect(s.save.dogs).toHaveLength(5);
    expect(s.save.homeDogIds).toHaveLength(3);
    expect(Object.keys(s.minds)).toHaveLength(3);
  });

  it('pas de 9e chiot', () => {
    const s = adoptOne(family(8), 'Neuvieme');
    expect(s.save.dogs).toHaveLength(8);
  });

  it('échanger un chiot de la maison et un de la pension', () => {
    let s = family(4);
    const hotelDog = s.save.dogs.find((d) => !s.save.homeDogIds.includes(d.id));
    const homeDog = s.save.homeDogIds[1] ?? '';
    if (!hotelDog) throw new Error('personne à la pension');
    s = reduce(s, { type: 'family/move', dogId: hotelDog.id, to: 'home' });
    expect(s.save.homeDogIds).not.toContain(hotelDog.id);
    s = reduce(s, { type: 'family/move', dogId: homeDog, to: 'hotel' });
    expect(s.save.homeDogIds).not.toContain(homeDog);
    expect(s.minds[homeDog]).toBeUndefined();
    s = reduce(s, { type: 'family/move', dogId: hotelDog.id, to: 'home' });
    expect(s.save.homeDogIds).toContain(hotelDog.id);
    expect(s.minds[hotelDog.id]).toBeDefined();
  });

  it('au moins un chiot reste à la maison', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'family/move', dogId: dog(s).id, to: 'hotel' });
    expect(s.save.homeDogIds).toHaveLength(1);
  });

  it('la pension prend soin des chiots en l’absence du joueur', () => {
    let s = family(4);
    const hotelDog = s.save.dogs.find((d) => !s.save.homeDogIds.includes(d.id));
    s = reduce(s, { type: 'session/resume', now: s.save.lastSeenAt + 3 * DAY, tzOffsetMin: TZ });
    const after = s.save.dogs.find((d) => d.id === hotelDog?.id);
    expect(after?.needs.hunger).toBeGreaterThanOrEqual(BALANCE.family.hotelCare);
    expect(dog(s).needs.hunger).toBeLessThan(BALANCE.family.hotelCare);
  });

  it('le chiot actif reçoit les ordres et les soins', () => {
    let s = family(2);
    const second = s.save.homeDogIds[1] ?? '';
    s = reduce(s, { type: 'family/select', dogId: dog(s).id });
    expect(homeId(s)).toBe(dog(s).id);
    s = reduce(s, { type: 'family/select', dogId: second });
    expect(homeId(s)).toBe(second);
    s = reduce(s, { type: 'call' });
    expect(s.minds[second]?.activity).toBe('come');
  });
});

describe('F-VIE-4 : ils jouent, se mordillent et dorment ensemble', () => {
  const base: PuppyContext = {
    traits: { docility: 0.5, energy: 0.9, boldness: 0.7 },
    affection: 50,
    energy: 90,
    hunger: 80,
    thirst: 80,
    cleanliness: 90,
    fun: 80,
    night: false,
    bowls: [],
    toys: [],
    familiar: {},
    tricks: [],
    canLearnNew: true,
    repsNeeded: 4,
    selfId: 'a',
  };

  it('deux chiots proches et éveillés finissent par jouer, en se mordillant', () => {
    let a = createMind(3, { x: 0, z: 0.5 });
    let b = createMind(4, { x: 0.2, z: 0.5 });
    const seen = new Set<string>();
    let played = false;
    for (let t = 0; t < 60_000; t += 100) {
      const ra = tickMind(a, 100, { ...base, selfId: 'a', friends: [{ id: 'b', pos: b.pos, activity: b.activity, partner: b.play?.partner ?? null }] });
      const rb = tickMind(b, 100, { ...base, selfId: 'b', friends: [{ id: 'a', pos: a.pos, activity: a.activity, partner: a.play?.partner ?? null }] });
      a = ra.mind;
      b = rb.mind;
      if (a.activity === 'play' && b.activity === 'play') played = true;
      for (const e of [...a.events, ...b.events]) seen.add(e.type);
    }
    expect(played).toBe(true);
    expect(seen.has('nibble')).toBe(true);
  });

  it('un chiot fatigué va dormir contre un autre chiot endormi', () => {
    let a = createMind(3, { x: -0.5, z: 0.4 });
    a = { ...a, lastInteractionAt: -1e9 };
    const sleeper = { id: 'b', pos: { x: 0.3, z: 0.5 }, activity: 'sleep' as const, partner: null };
    for (let t = 0; t < 20_000; t += 100) a = tickMind(a, 100, { ...base, energy: 10, friends: [sleeper] }).mind;
    expect(a.activity).toBe('sleep');
    expect(Math.hypot(a.pos.x - sleeper.pos.x, a.pos.z - sleeper.pos.z)).toBeLessThan(0.25);
    expect(a.posture).toBe('lie');
  });

  it('dans la partie, trois chiots vivent ensemble sans erreur', () => {
    let s = startWithDog(T0, TZ);
    s = adoptOne(s, 'Biscotte');
    s = adoptOne(s, 'Pistache');
    s = advance(s, 60_000);
    expect(Object.keys(s.minds)).toHaveLength(3);
    for (const id of s.save.homeDogIds) expect(Number.isFinite(s.minds[id]?.pos.x)).toBe(true);
  });
});

describe('Migration v4 → v5 (luminosité)', () => {
  it('ajoute la luminosité par défaut et garde les autres réglages', () => {
    const g = createNewGame(1000, 1);
    const old: Record<string, unknown> = { ...g.settings, musicVolume: 0.2 };
    delete old.brightness;
    const v4 = { ...g, version: 4, settings: old };
    const out = migrate(v4);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.settings.brightness).toBe(BALANCE.display.defaultBrightness);
    expect(out.settings.musicVolume).toBe(0.2);
  });
});

describe('Migration v3 → v4 (jalon 6)', () => {
  it('ajoute le palier de déblocage et le décor', () => {
    const v3: Record<string, unknown> = { ...createNewGame(1000, 1), version: 3 };
    delete v3.unlockTier;
    v3.settings = { reduceMotion: false, musicVolume: 0.6, sfxVolume: 0.8, micAllowed: null };
    const g = migrate(v3);
    expect(g.version).toBe(SAVE_VERSION);
    expect(g.unlockTier).toBe(0);
    expect(g.settings.decor).toBe('home');
  });
});
