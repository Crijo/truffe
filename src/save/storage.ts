import { openDB, type IDBPDatabase } from 'idb';
import type { SaveGame } from '../sim/state';
import { migrate } from './migrations';

const DB_NAME = 'truffe';
const STORE = 'saves';
type Slot = 'current' | 'previous';

export interface SaveStore {
  /** Dernière sauvegarde valide, la précédente si la dernière est corrompue, sinon null. */
  load(): Promise<SaveGame | null>;
  /** Écrit la partie ; l'ancienne copie devient « previous » dans la même transaction. */
  save(game: SaveGame): Promise<void>;
  close(): void;
  writeRawForTests(slot: Slot, value: unknown): Promise<void>;
}

export async function openSaveStore(): Promise<SaveStore> {
  const db: IDBPDatabase = await openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore(STORE);
    },
  });

  const read = async (slot: Slot): Promise<SaveGame | null> => {
    const raw: unknown = await db.get(STORE, slot);
    if (raw === undefined) return null;
    try {
      // Stockée en JSON : une écriture tronquée est détectée au lieu d'être lue à moitié.
      return migrate(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch {
      return null;
    }
  };

  return {
    async load() {
      return (await read('current')) ?? (await read('previous'));
    },
    async save(game) {
      const tx = db.transaction(STORE, 'readwrite');
      const current: unknown = await tx.store.get('current');
      if (current !== undefined) await tx.store.put(current, 'previous');
      await tx.store.put(JSON.stringify(game), 'current');
      await tx.done;
    },
    close() {
      db.close();
    },
    async writeRawForTests(slot, value) {
      await db.put(STORE, value, slot);
    },
  };
}
