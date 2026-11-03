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

  it('luminosité : réglable de 0 à 1, plus claire par défaut (D-72)', async () => {
    const { BALANCE } = await import('../../src/data/balance');
    let s = startWithDog(T0, -60);
    expect(s.save.settings.brightness).toBe(BALANCE.display.defaultBrightness);
    s = reduce(s, { type: 'settings/set', patch: { brightness: 1 } });
    expect(s.save.settings.brightness).toBe(1);
    s = reduce(s, { type: 'settings/set', patch: { brightness: 7 } });
    expect(s.save.settings.brightness).toBe(1);
  });

  it('la nuit assombrit moins quand la luminosité monte, et plus du tout au maximum', async () => {
    const { nightAlpha } = await import('../../src/sim/needs');
    expect(nightAlpha(1, 0)).toBeGreaterThan(nightAlpha(1, 0.5));
    expect(nightAlpha(1, 0.5)).toBeGreaterThan(nightAlpha(1, 0.8));
    expect(nightAlpha(1, 1)).toBe(0);
    expect(nightAlpha(0, 0)).toBe(0);
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
