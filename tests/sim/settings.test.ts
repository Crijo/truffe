import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/sim/game';
import { startWithDog } from './fixtures';

const T0 = Date.UTC(2026, 10, 3, 13, 0);

describe('Réglages (jalon 7 : accessibilité et audio)', () => {
  it('réduire les animations, volume des sons et de la musique', () => {
    let s = startWithDog(T0, -60);
    s = reduce(s, { type: 'settings/set', patch: { reduceMotion: true, musicVolume: 0, sfxVolume: 0.3 } });
    expect(s.save.settings).toMatchObject({ reduceMotion: true, musicVolume: 0, sfxVolume: 0.3 });
  });

  it('les volumes restent entre 0 et 1', () => {
    let s = startWithDog(T0, -60);
    s = reduce(s, { type: 'settings/set', patch: { musicVolume: 3, sfxVolume: -1 } });
    expect(s.save.settings.musicVolume).toBe(1);
    expect(s.save.settings.sfxVolume).toBe(0);
  });

  it('effacer les empreintes vocales ne touche pas aux tours', () => {
    let s = startWithDog(T0, -60);
    s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, voiceName: [[[1]]], tricks: [{ trickId: 'sit' as const, repetitions: 5, learned: true, mastery: 0.5, command: { label: 'Assis', voice: [[[1, 2]]] } }] })) } };
    s = reduce(s, { type: 'voice/clearAll' });
    const d = s.save.dogs[0];
    expect(d?.voiceName).toBeUndefined();
    expect(d?.tricks[0]?.command).toEqual({ label: 'Assis' });
    expect(d?.tricks[0]?.learned).toBe(true);
  });
});
