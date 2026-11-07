# Truffe — consignes pour Claude Code

Jeu web de chiot virtuel. La spécification fait foi : `SPEC.md`. Les choix pris là où la spec est muette ou ambiguë sont dans `DECISIONS.md`.

## Jalon en cours

Aucun. Les jalons 0 à 7 de la spec, le jalon 8 (retours de bêta : pelage, saleté, besoins, obéissance, saisons, niveaux, tracé en concours, atelier des tours, pas réels), le jalon 9 (fenêtre, profondeur et décor de promenade, jauge « Amusement », lancer hors de l'écran) le jalon 10 (salle de bain, ménage, salon navigable, panier, promenade variée et plus rapide, XP séparées, carlin) le jalon 11 (main et pommeau dessinés par le joueur) et le jalon 12 (salle de bain dans le menu, jardin et trous à trésors, croquettes à acheter, Sac qui défile, prix au chenil) et le jalon 13 (appli Android, mises à jour à distance) sont validés.

**Jalon 14 : fenêtre de mise à jour** — au lancement de l'appli, une fenêtre annonce la mise à jour disponible et ses nouveautés. En attente de l'accord du joueur.

Jalons 0 à 13 : validés. Jalon 14 : en attente de l'accord du joueur. Si une session s'interrompt, reprendre à la première étape non commitée du jalon (voir `git log`).

Un jalon à la fois, dans l'ordre. Un jalon n'est terminé qu'après `npm run check` au vert **et** vérification de ses critères d'acceptation dans un navigateur. À la fin de chaque jalon : bilan critère par critère, mode d'emploi sur téléphone, liste de ce que le joueur doit vérifier lui-même, puis arrêt jusqu'à son accord.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm install` | Installer les dépendances |
| `npm run dev` | Serveur de développement (accessible sur le réseau local) |
| `npm run dev:https` | Idem en HTTPS (certificat local) : nécessaire pour le micro sur téléphone |
| `npm run build` | Construction de production dans `dist/` |
| `npm run preview` | Servir `dist/` sur le réseau local |
| `npm run check` | Lint + types + tests unitaires (doit passer avant tout commit) |
| `npm run lint` / `npm run typecheck` / `npm test` | Étapes séparées de `check` |
| `npm run e2e` | Parcours Playwright (Chromium) |
| `npm run balance` | Équilibrage : 30 jours de joueurs types, rythme des déblocages |
| `npm run perf` | Mesures de performance (PERF.md), à lancer seules |
| `npm run build:app` | Jeu pour l'appli Android (`dist-app/`) et copie dans `android/` (D-100) |

Dépôt public : https://github.com/Crijo/truffe. Chaque envoi sur `main` lance `npm run check`, construit et publie sur https://crijo.github.io/truffe/ (`.github/workflows/pages.yml`). Les enregistrements vocaux de test (`tests/fixtures/voice/`) ne sont jamais commités.

Appli Android (D-100, D-101) : le workflow « Android » construit l'APK et le publie dans les Releases (`truffe.apk`) si les secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD` et `ANDROID_KEY_ALIAS` existent. La clé de signature est hors du dépôt (`D:\jeux-claude\truffe-signature\`) et ne doit jamais y entrer. Chaque envoi sur `main` publie aussi `app/latest.json` et le paquet du jeu : l'appli se met à jour seule. Toucher à `android/` ou ajouter un plugin Capacitor : augmenter `versionCode` (et `versionName`, identique) dans `android/app/build.gradle`, et `android/min-native` si le jeu ne peut plus tourner dans l'ancienne appli.

Paramètres de débogage de l'URL : `?debug` (panneau d'état, `window.__truffe`), `&adopt=beagle` (adoption immédiate, pour les tests), `&gallery` et `&gallery&silhouette` (les 6 races côte à côte), `&season=winter` (saison imposée : spring, summer, autumn, winter), `&gallery&breed=carlin&trick=roll&facing=0.6&at=900` (un tour figé à 900 ms, pour vérifier une animation).

## Architecture

```text
src/
  sim/     Logique pure : aucun DOM, aucune horloge, aucun Math.random
  data/    Contenu et équilibrage (balance.ts = toutes les valeurs chiffrées)
  render/  PixiJS : chiot articulé, animations, scènes
  input/   Gestes, voix
  audio/   Sons (Web Audio)
  ui/      Écrans et menus (DOM)
  save/    IndexedDB, migrations, double copie
  core/    Boucle de jeu, store d'état, horloge et RNG injectés
  main.ts
tests/     Vitest (tests/sim, tests/save…) et Playwright (tests/e2e)
```

Règles de dépendance (vérifiées par ESLint quand c'est possible) :

- `sim/` n'importe que `data/` et d'autres fichiers de `sim/`. Le temps (`now: number`, ms) et un RNG à graine (`Rng`) sont passés en paramètres.
- `render/` et `ui/` lisent l'état et envoient des actions au store ; ils ne modifient jamais l'état directement.
- Toute valeur d'équilibrage vit dans `src/data/balance.ts`, jamais en dur ailleurs.
- La simulation avance à pas fixe de 100 ms ; le rendu suit `requestAnimationFrame`.
- TypeScript strict, pas de `any` sans commentaire de justification.
- Toute nouvelle dépendance est justifiée dans `DECISIONS.md`.

## Méthode

- Tests d'abord pour `sim/` (et `save/`), puis le code.
- Les identifiants d'exigence (`F-MAIN-1`…) apparaissent dans les noms de tests et les messages de commit.
- Commits en français, petits, un sujet par commit.

## Propriété intellectuelle

Aucun nom, image, son, texte ou objet du jeu d'origine cité dans `SPEC.md`, ni de son éditeur. Tout contenu est créé pour le projet (dessin par le code, sons de synthèse) et son origine est notée dans `ASSETS.md`. Ce nom de marque ne doit apparaître dans aucun fichier du dépôt sauf `SPEC.md` : écrire « le jeu d'origine » à la place.
