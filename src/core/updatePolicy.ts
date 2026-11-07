/**
 * D-101 : que faire d'après le fichier de version publié sur GitHub Pages (app/latest.json) ?
 * Logique pure, testée ; le téléchargement lui-même est dans ui/appUpdate.ts.
 */

export interface UpdateManifest {
  /** Version du jeu publiée (identifiant du commit). */
  version: string;
  /** Paquet du jeu (zip) pour cette version. */
  bundle: string;
  /** Version de l'appli Android nécessaire pour ce paquet. */
  minNative: number;
  /** Dernière version de l'appli Android publiée, et son APK. */
  native: number;
  apk: string;
}

export interface InstalledApp {
  /** Version du jeu qui tourne. */
  version: string;
  /** Version de l'appli Android installée. */
  native: number;
  /** Version déjà téléchargée, en attente du prochain démarrage. */
  pending: string | null;
}

export type UpdateDecision =
  | { kind: 'none'; newerApk?: string }
  | { kind: 'bundle'; version: string; url: string }
  | { kind: 'ready'; version: string }
  | { kind: 'native'; url: string };

const https = (v: unknown): v is string => typeof v === 'string' && v.startsWith('https://');

/** Lit le fichier de version ; null s'il est abîmé (on ne met alors rien à jour). */
export function parseManifest(raw: unknown): UpdateManifest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.version !== 'string' || m.version === '' || !https(m.bundle) || !https(m.apk)) return null;
  if (typeof m.minNative !== 'number' || typeof m.native !== 'number') return null;
  return { version: m.version, bundle: m.bundle, minNative: m.minNative, native: m.native, apk: m.apk };
}

export function updateDecision(m: UpdateManifest, app: InstalledApp): UpdateDecision {
  // Le nouveau jeu a besoin d'une appli plus récente : seul l'APK peut l'apporter.
  if (m.version !== app.version && m.minNative > app.native) return { kind: 'native', url: m.apk };
  if (m.version === app.version) return m.native > app.native ? { kind: 'none', newerApk: m.apk } : { kind: 'none' };
  if (app.pending === m.version) return { kind: 'ready', version: m.version };
  return { kind: 'bundle', version: m.version, url: m.bundle };
}
