# Origine des ressources

Toute ressource du dépôt est créée pour le projet ou placée sous licence CC0. Une ligne par fichier ou par famille de ressources.

## Images

| Ressource | Fichier | Origine | Licence |
| --- | --- | --- | --- |
| Icône (empreinte de patte) | `public/favicon.svg` | Dessinée à la main en SVG pour Truffe | Propre au projet |
| Icônes de l’application installée | `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/apple-touch-icon.png` | Rendues depuis `favicon.svg` par `scripts/make-icons.mjs` | Propre au projet |
| Décor du salon | `src/render/stage.ts` | Formes dessinées par le code (PixiJS `Graphics`) | Propre au projet |
| Icônes de l'interface (sac, porte, micro, fiche, gamelles, brosse, bain, savon, douche, serviette, besoins, lune) | `src/ui/icons.ts` | SVG dessinés à la main pour Truffe | Propre au projet |
| Gamelles, mousse, gouttes, saleté, éclat, « Z » de sommeil, teinte de nuit | `src/render/bowls.ts`, `src/render/puppy/PuppyView.ts`, `src/render/stage.ts` | Formes dessinées par le code | Propre au projet |
| Chiots articulés des 6 races et leurs robes | `src/render/puppy/PuppyView.ts`, `src/data/breeds.ts` | Ellipsoïdes projetés et dessinés par le code ; proportions, formes d'oreilles et de queues et couleurs choisies pour Truffe d'après l'allure générale des races réelles | Propre au projet |
| Portraits du chenil | générés au lancement | Rendu des chiots ci-dessus | Propre au projet |
| Balle, disque, corde et leurs icônes | `src/render/toys.ts`, `src/ui/icons.ts` | Formes dessinées par le code et SVG à la main | Propre au projet |
| 36 objets (noms et icônes) | `src/data/items.ts`, `src/ui/itemIcon.ts` | Noms français courants et SVG dessinés à la main pour Truffe, aucune marque | Propre au projet |
| Accessoires portés par le chiot | `src/render/puppy/PuppyView.ts` | Formes dessinées par le code | Propre au projet |
| Races débloquées (husky, caniche, corgi, dalmatien) | `src/data/breeds.ts` | Mêmes chiots articulés, proportions et robes choisies pour Truffe | Propre au projet |
| Terrains de concours, haies, tunnel, slalom, balançoire, disque | `src/render/contestScene.ts` | Formes dessinées par le code | Propre au projet |
| Décors « Bord de mer » et « Espace », canapé, gros ballon, souris mécanique, coupe | `src/render/stage.ts`, `src/data/items.ts`, `src/ui/itemIcon.ts`, `src/ui/icons.ts` | Formes et SVG dessinés pour Truffe | Propre au projet |
| Noms des rivaux de concours | `src/data/strings.ts` | Mots français courants choisis pour Truffe | Propre au projet |
| Dessins à retracer des 16 tours, icônes cadenas, étoile (atelier) et empreintes (pas) | `src/data/traceShapes.ts`, `src/ui/icons.ts` | Tracés géométriques créés pour Truffe | Propre au projet |
| Saisons : fenêtre sur le jardin, arbres en fleurs, feuillage d’automne, branches nues et neige, pétales, feuilles et flocons qui tombent | `src/data/seasons.ts`, `src/render/seasonFx.ts`, `src/render/stage.ts`, `src/render/walkScene.ts` | Formes et couleurs dessinées par le code pour Truffe | Propre au projet |
| Besoins au salon et mouches, main qui caresse, icône de bulles (pelage), engrenage (réglages) | `src/render/poops.ts`, `src/ui/icons.ts` | Formes et SVG dessinés pour Truffe | Propre au projet |
| Plan de la ville, décor de promenade, enseignes | `src/ui/walkMap.ts`, `src/render/walkScene.ts` | SVG et formes dessinés par le code | Propre au projet |
| Salle de bain (carrelage, bac de douche, pommeau, miroir, flacons, serviette), gouttes, bulles et souffle | `src/render/bathScene.ts` | Formes dessinées par le code pour Truffe | Propre au projet |
| Icônes sèche-cheveux, éponge, panier, « Toi » ; panier de rangement | `src/ui/icons.ts` | SVG dessinés à la main pour Truffe | Propre au projet |
| Taches du salon (pattes, miettes, poils), mobilier des côtés du salon (cadre, plante, panier, porte, bibliothèque), repères des chiots hors de vue | `src/render/dirt.ts`, `src/render/stage.ts`, `src/main.ts` | Formes dessinées par le code pour Truffe | Propre au projet |
| Rues de la promenade (maisons, boutiques et leurs stores, parc, clôture, réverbères, jardinières, rues de côté, passages piétons, panneaux de direction, lampadaires et buissons au premier plan) et petit plan du trajet | `src/render/streets.ts`, `src/ui/walkHud.ts` | Formes et SVG dessinés par le code pour Truffe, aucune enseigne réelle | Propre au projet |
| Main qui caresse, pommeau de douche (curseur et bouton Douche) | `public/img/main.webp`, `public/img/pommeau.webp` | Dessins fournis par le joueur, propriétaire du projet, pour Truffe ; réduits à 192 et 300 px de large et convertis en WebP | Propre au projet |
| Jardin (pelouse, clôture, arbres, massif de fleurs, niche, abri, porte de la maison), tas de terre et trous, panneau du jardin sur la porte du salon, icônes arbre et sac de croquettes | `src/render/stage.ts`, `src/render/garden.ts`, `src/ui/icons.ts`, `src/ui/itemIcon.ts` | Formes et SVG dessinés par le code pour Truffe | Propre au projet |
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
| Savon, douche, sèche-cheveux, brosse | Bruits filtrés brefs pendant le geste (le sèche-cheveux ajoute un léger bourdonnement en dent de scie) |
| Étape du bain finie | Petite cloche : deux notes sinusoïdales, la seconde plus aiguë |
| Halètement | Souffles de bruit filtré rapides et alternés |

Musique et ambiances, synthétisées en direct dans `src/audio/music.ts` : aucun fichier audio.

| Son | Procédé |
| --- | --- |
| Musique du salon, de la promenade, des concours | Courtes mélodies composées pour Truffe sur la gamme pentatonique de do, notes pincées triangle et basse sinusoïdale, en boucle |
| Oiseaux (dehors) | Deux glissandos sinusoïdaux aigus et brefs, au hasard |

| Ampoule, tour appris, « ? » | Glissandos et petits accords sinusoïdaux |

## Données de test (non livrées dans le jeu)

| Ressource | Fichier | Origine |
| --- | --- | --- |
| Enregistrements vocaux de test | `tests/fixtures/voice/*.wav` | Synthèse vocale de Windows (voix française installée avec le système), générés par `scripts/make-voice-fixtures.ps1`. Servent uniquement aux tests de reconnaissance. **Non publiés** dans le dépôt public (licence de la voix non vérifiée) : à régénérer en local. |

## Polices

Aucune police embarquée : police système de l'appareil.
