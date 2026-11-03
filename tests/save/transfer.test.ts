import { describe, expect, it } from 'vitest';
import { exportFileName, exportSave, importSave } from '../../src/save/transfer';
import { SaveError } from '../../src/save/migrations';
import { createNewGame } from '../../src/sim/game';
import { SAVE_VERSION } from '../../src/sim/state';

describe('Export et import de la sauvegarde (jalon 7)', () => {
  it('un export se réimporte à l’identique', () => {
    const g = { ...createNewGame(1000, 7), coins: 1234, masterPoints: 567 };
    expect(importSave(exportSave(g, 5000))).toEqual(g);
  });

  it('le fichier exporté est un JSON lisible, marqué comme sauvegarde de Truffe', () => {
    const data = JSON.parse(exportSave(createNewGame(1000, 1), 5000)) as Record<string, unknown>;
    expect(data.format).toBe('truffe-sauvegarde');
    expect(data.exportedAt).toBe(5000);
    expect((data.save as { version: number }).version).toBe(SAVE_VERSION);
  });

  it('une ancienne sauvegarde est migrée à l’import', () => {
    const v3: Record<string, unknown> = { ...createNewGame(1000, 1), version: 3, settings: { reduceMotion: false, musicVolume: 0.6, sfxVolume: 0.8, micAllowed: null } };
    delete v3.unlockTier;
    const g = importSave(JSON.stringify({ format: 'truffe-sauvegarde', exportedAt: 1, save: v3 }));
    expect(g.version).toBe(SAVE_VERSION);
    expect(g.settings.decor).toBe('home');
  });

  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => importSave('pas du json')).toThrow(SaveError);
    expect(() => importSave(JSON.stringify({ format: 'autre chose', save: createNewGame(1, 1) }))).toThrow(SaveError);
    expect(() => importSave(JSON.stringify({ format: 'truffe-sauvegarde', save: { version: 2 } }))).toThrow(SaveError);
    expect(() => importSave('')).toThrow(SaveError);
  });

  it('nom de fichier daté', () => {
    expect(exportFileName(Date.UTC(2026, 10, 3, 12))).toBe('truffe-sauvegarde-2026-11-03.json');
  });
});
