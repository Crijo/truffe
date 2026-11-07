// D-101, D-102 : écrit dist/app/latest.json, le fichier de version que l'appli Android consulte.
// Usage (GitHub Actions) : node scripts/app-manifest.mjs <version du jeu>
// Les nouveautés viennent de public/app-notes.json (à mettre à jour à chaque jalon).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const version = process.argv[2];
if (!version) throw new Error('version du jeu manquante');
const gradle = readFileSync('android/app/build.gradle', 'utf8');
const native = Number(/^\s*versionCode\s+(\d+)/m.exec(gradle)?.[1]);
const minNative = Number(readFileSync('android/min-native', 'utf8').trim());
if (!native || !minNative) throw new Error('versionCode ou min-native illisible');
const notes = JSON.parse(readFileSync('public/app-notes.json', 'utf8'));
const manifest = {
  version,
  bundle: `https://crijo.github.io/truffe/app/bundle-${version}.zip`,
  // D-104 : empreinte SHA-256 du paquet, exigée par le module de mise à jour de l'appli.
  checksum: createHash('sha256').update(readFileSync(`dist/app/bundle-${version}.zip`)).digest('hex'),
  minNative,
  native,
  apk: 'https://github.com/Crijo/truffe/releases/latest/download/truffe.apk',
  notes,
};
writeFileSync('dist/app/latest.json', JSON.stringify(manifest));
console.log(JSON.stringify(manifest, null, 2));
