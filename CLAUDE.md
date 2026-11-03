# Truffe — consignes pour Claude Code

Jeu web de chiot virtuel. La spécification fait foi : `SPEC.md`. Les choix pris là où la spec est muette ou ambiguë sont dans `DECISIONS.md`.

## Jalon en cours

**Jalon 6 : concours et progression** — F-CON, F-ECO-1, F-ECO-2, déblocages, plusieurs chiots et F-VIE-4.

Jalons 0 à 5 : validés. Si une session s'interrompt, reprendre à la première étape non commitée du jalon (voir `git log`).

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

Dépôt public : https://github.com/Crijo/truffe. Chaque envoi sur `main` lance `npm run check`, construit et publie sur https://crijo.github.io/truffe/ (`.github/workflows/pages.yml`). Les enregistrements vocaux de test (`tests/fixtures/voice/`) ne sont jamais commités.

Paramètres de débogage de l'URL : `?debug` (panneau d'état, `window.__truffe`), `&adopt=beagle` (adoption immédiate, pour les tests), `&gallery` et `&gallery&silhouette` (les 6 races côte à côte).

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
