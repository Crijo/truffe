# Origine des ressources

Toute ressource du dépôt est créée pour le projet ou placée sous licence CC0. Une ligne par fichier ou par famille de ressources.

## Images

| Ressource | Fichier | Origine | Licence |
| --- | --- | --- | --- |
| Icône (empreinte de patte) | `public/favicon.svg` | Dessinée à la main en SVG pour Truffe | Propre au projet |
| Décor du salon | `src/render/stage.ts` | Formes dessinées par le code (PixiJS `Graphics`) | Propre au projet |
| Chiot articulé (beagle) | `src/render/puppy/PuppyView.ts`, `src/data/breeds.ts` | Ellipsoïdes projetés et dessinés par le code, proportions et couleurs choisies pour Truffe | Propre au projet |

## Sons

Tous synthétisés en direct par Web Audio dans `src/audio/sfx.ts` : aucun fichier audio.

| Son | Procédé |
| --- | --- |
| Aboiement, jappement, glapissement | Oscillateur en glissando descendant, filtre passe-bande « formant », souffle bref |
| Gémissement, hurlement | Oscillateur avec vibrato, montée puis descente |
| Bâillement | Dent de scie filtrée, descente lente, petit couinement final |
| Reniflement, léchage | Rafales de bruit blanc filtré |
| Ébrouement, grattage, creusage | Bruit haché à cadence fixe |

## Polices

Aucune police embarquée : police système de l'appareil.
