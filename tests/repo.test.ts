import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Jalon 7 : aucune mention du jeu d'origine ni de son éditeur hors de SPEC.md.
 * Les mots cherchés sont assemblés ici pour que ce fichier ne les contienne pas lui-même.
 */
const BRAND = new RegExp(['nin' + 'tendo', 'nin' + 'tendogs', 'bark ' + 'mode', 'super ' + 'mario', 'poké' + 'mon', 'zel' + 'da'].join('|'), 'i');

describe('Propriété intellectuelle', () => {
  it('aucun fichier du dépôt ne cite la marque, sauf SPEC.md', () => {
    const files = execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && f !== 'SPEC.md' && !/\.(png|jpe?g|wav|ico)$/i.test(f));
    const hits = files.filter((f) => BRAND.test(f) || BRAND.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
