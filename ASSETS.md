# Origine des ressources

Toute ressource du dépôt est créée pour le projet ou placée sous licence CC0. Une ligne par fichier ou par famille de ressources.

## Images

| Ressource | Fichier | Origine | Licence |
| --- | --- | --- | --- |
| Icône (empreinte de patte) | `public/favicon.svg` | Dessinée à la main en SVG pour Truffe | Propre au projet |
| Décor du salon | `src/render/stage.ts` | Formes dessinées par le code (PixiJS `Graphics`) | Propre au projet |
| Icônes de l'interface (sac, porte, micro, fiche, gamelles, brosse, bain, savon, douche, serviette, besoins, lune) | `src/ui/icons.ts` | SVG dessinés à la main pour Truffe | Propre au projet |
| Gamelles, mousse, gouttes, saleté, éclat, « Z » de sommeil, teinte de nuit | `src/render/bowls.ts`, `src/render/puppy/PuppyView.ts`, `src/render/stage.ts` | Formes dessinées par le code | Propre au projet |
| Chiots articulés des 6 races et leurs robes | `src/render/puppy/PuppyView.ts`, `src/data/breeds.ts` | Ellipsoïdes projetés et dessinés par le code ; proportions, formes d'oreilles et de queues et couleurs choisies pour Truffe d'après l'allure générale des races réelles | Propre au projet |
| Portraits du chenil | générés au lancement | Rendu des chiots ci-dessus | Propre au projet |
| Balle, disque, corde et leurs icônes | `src/render/toys.ts`, `src/ui/icons.ts` | Formes dessinées par le code et SVG à la main | Propre au projet |
| 36 objets (noms et icônes) | `src/data/items.ts`, `src/ui/itemIcon.ts` | Noms français courants et SVG dessinés à la main pour Truffe, aucune marque | Propre au projet |
| Accessoires portés par le chiot | `src/render/puppy/PuppyView.ts` | Formes dessinées par le code | Propre au projet |
| Plan de la ville, décor de promenade, enseignes | `src/ui/walkMap.ts`, `src/render/walkScene.ts` | SVG et formes dessinés par le code | Propre au projet |
| Idées de noms du chenil | `src/data/strings.ts` | Mots français courants choisis pour Truffe | Propre au projet |

## Sons

Tous synthétisés en direct par Web Audio dans `src/audio/sfx.ts` : aucun fichier audio.

| Son | Procédé |
| --- | --- |
| Aboiement, jappement, glapissement | Oscillateur en glissando descendant, filtre passe-bande « formant », souffle bref |
| Gémissement, hurlement | Oscillateur avec vibrato, montée puis descente |
| Bâillement | Dent de scie filtrée, descente lente, petit couinement final |
| Reniflement, léchage | Rafales de bruit blanc filtré |
| Ébrouement, grattage, creusage | Bruit haché à cadence fixe |
| Croquer, laper, se lécher les babines, ronfler, s'étirer | Rafales de bruit filtré, petit glissando |
| Savon, douche, serviette, brosse | Bruits filtrés brefs pendant le geste |

| Ampoule, tour appris, « ? » | Glissandos et petits accords sinusoïdaux |

## Données de test (non livrées dans le jeu)

| Ressource | Fichier | Origine |
| --- | --- | --- |
| Enregistrements vocaux de test | `tests/fixtures/voice/*.wav` | Synthèse vocale de Windows (voix française installée avec le système), générés par `scripts/make-voice-fixtures.ps1`. Servent uniquement aux tests de reconnaissance ; à remplacer par des enregistrements CC0 avant toute diffusion du dépôt si la licence de la voix l'exige. |

## Polices

Aucune police embarquée : police système de l'appareil.
