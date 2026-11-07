import { describe, expect, it } from 'vitest';
import { parseManifest, updateDecision } from '../../src/core/updatePolicy';

const manifest = { version: 'b2', bundle: 'https://exemple.test/app/bundle-b2.zip', minNative: 1, native: 1, apk: 'https://exemple.test/truffe.apk' };

describe('D-101 : mises à jour de l’appli à distance', () => {
  it('même version : rien à faire', () => {
    expect(updateDecision(manifest, { version: 'b2', native: 1, pending: null })).toEqual({ kind: 'none' });
  });

  it('nouvelle version du jeu : on télécharge le paquet', () => {
    expect(updateDecision(manifest, { version: 'a1', native: 1, pending: null })).toEqual({ kind: 'bundle', version: 'b2', url: manifest.bundle });
  });

  it('déjà téléchargée, en attente du prochain démarrage : on ne la retélécharge pas', () => {
    expect(updateDecision(manifest, { version: 'a1', native: 1, pending: 'b2' })).toEqual({ kind: 'ready', version: 'b2' });
  });

  it('le jeu demande une appli plus récente : on propose l’APK, pas le paquet', () => {
    expect(updateDecision({ ...manifest, minNative: 2, native: 2 }, { version: 'a1', native: 1, pending: null })).toEqual({ kind: 'native', url: manifest.apk });
  });

  it('une appli plus récente existe mais n’est pas nécessaire : le paquet suffit, l’APK est proposé en plus', () => {
    expect(updateDecision({ ...manifest, native: 3 }, { version: 'b2', native: 1, pending: null })).toEqual({ kind: 'none', newerApk: manifest.apk });
  });

  it('un fichier de version abîmé est ignoré', () => {
    expect(parseManifest({ version: 3 })).toBeNull();
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ ...manifest, bundle: 'http://pas-https.test/x.zip' })).toBeNull();
    expect(parseManifest(manifest)).toEqual(manifest);
  });
});
