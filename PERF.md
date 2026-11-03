# Performances mesurées

Cibles : SPEC, « Performance et compatibilité ». Mesures du 3 novembre 2026, construction de production (`npm run build`), reproduites par `npm run perf` (résultats dans `test-results/perf.json`) et `npx vitest run tests/input/voicePerf.test.ts`.

## Méthode

- **Téléphone de milieu de gamme 2022** : Chromium en émulation Pixel 7 (412 × 915, densité 2,6), rendu GPU, processeur ralenti 4 fois par les outils de Chrome (`Emulation.setCPUThrottlingRate`).
- **4G** : profil « Slow 4G » des outils de Chrome, 1,6 Mbit/s descendant, 150 ms d'aller-retour, sans cache ni service worker (première visite).
- **Images par seconde** : comptées seconde par seconde avec `requestAnimationFrame`, trois chiots au salon (beagle, labrador, carlin) qui jouent ensemble.
- **Reconnaissance vocale** : extraction MFCC et comparaison DTW d'un mot d'une seconde contre 15 ordres × 5 modèles (le maximum : 14 tours et le nom), sur l'ordinateur de développement ; la cible tient compte d'un téléphone 3 à 4 fois plus lent.

## Résultats

| Critère | Cible | Mesure | Verdict |
| --- | --- | --- | --- |
| Fluidité, 3 chiots | 60 i/s ; jamais sous 30 | 60 i/s, minimum 60 (processeur ralenti 4 fois) | Atteinte |
| Premier affichage en 4G | < 3 s | Premier rendu 2,3 s ; chenil prêt à 2,8 s | Atteinte, avec peu de marge |
| Poids initial | < 2 Mo hors sons | 233 Kio transférés (compressés) ; 798 Kio en cache hors ligne | Atteinte |
| Reconnaissance | < 300 ms après la fin de la parole | 18 ms (pire cas, ordinateur) ; ≈ 60 à 80 ms estimés sur téléphone | Atteinte |
| Navigateurs | Chrome, Safari, Firefox, Edge | Parcours de compatibilité : Chromium et WebKit en local, et les trois moteurs dans GitHub Actions (`compat.yml`). Edge partage le moteur de Chrome. | Voir la note |

## Limites

- Les chiffres viennent d'une émulation ; seul un vrai téléphone confirme la fluidité et le temps de chargement. Le compteur du panneau `?debug` permet de vérifier sur l'appareil.
- Sous Windows, Firefox n'a pas pu être lancé en local (exécutable bloqué par le système) : sa vérification passe par GitHub Actions.
- Le premier affichage en 4G tient en 2,8 s : le plus gros fichier est le moteur de rendu (159 Kio compressés). Les visites suivantes viennent du cache et ne dépendent plus du réseau.
