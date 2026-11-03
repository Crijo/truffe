# Décisions

Choix pris là où `SPEC.md` est muette, ambiguë ou contradictoire. Chaque décision peut être remise en cause ; on la modifie ici et dans `src/data/balance.ts`.

## Ambiguïtés et contradictions relevées

| # | Sujet | Constat | Décision |
| --- | --- | --- | --- |
| D-01 | Micro à l'adoption | F-ADO-3 fait prononcer le nom à l'adoption, mais « Accessibilité et confidentialité » dit que le micro n'est demandé qu'au premier dressage vocal. | La première demande de micro a lieu à la première utilisation vocale, quelle qu'elle soit. À l'adoption, un écran explique l'usage et propose « Plus tard » ; le nom vocal peut être enregistré ensuite depuis la fiche. |
| D-02 | Chenil | F-ADO-1 « 3 chiots pour chacune des 6 races » : 18 chiots d'un coup, ou 3 après choix de la race ? | L'écran Chenil (« choix de la race, puis des chiots ») tranche : on choisit la race, puis 3 chiots de cette race sont présentés. |
| D-03 | Soif chaque matin | Soif −6/h depuis 80 : niveau « Urgent » après ~11 h. Un joueur qui vient une fois par jour retrouverait un chiot qui boude à chaque retour (Bouder = besoin urgent), contre F-VIE-2/F-VIE-3. | Au retour, l'accueil (F-VIE-2) passe toujours en premier. La bouderie liée à un besoin ne démarre qu'après 2 minutes de session sans y répondre. Valeurs dans `balance.ts`. |
| D-04 | Concours et soif | F-CON-7 / seuil d'inscription : faim ou pelage « Urgent », la soif n'est pas citée. | On suit la spec à la lettre : faim ou pelage. La soif urgente donne seulement le malus d'obéissance. |
| D-05 | Ce qu'est « une caresse » | F-MAIN-1 / Affection +1 par caresse, plafond 15/jour. | Une caresse = un glissement continu d'au moins 60 px sur le chiot ; au plus une caresse comptée toutes les 2 s. |
| D-06 | Toucher « à répétition » | F-MAIN-3, sans seuil. | 2 touchers hors du chiot en moins de 1,2 s. |
| D-07 | Tirage « répété » | F-MAIN-4, sans seuil. | 3 tirages en moins de 10 s → recul, −1 affection par tirage suivant, état Bouder possible. |
| D-08 | « Besoin réel » pour les gains | Gains « si besoin réel » non définis. | Besoin réel = jauge sous le niveau « Excellent » (faim/soif < 75, propreté < 90). |
| D-09 | Brossage | F-SOIN-3 « fait briller » sans effet chiffré ; le « Pelage » affiché suit la propreté. | Brossage : +15 propreté (plafond 100) et brillance visuelle temporaire. Le bain remet à 100. |
| D-10 | Nuit | F-VIE-1 « selon l'heure locale », sans horaires. | Nuit de 22 h à 7 h (heure locale). |
| D-11 | Énergie hors ligne | Le tableau ne dit pas comment l'énergie évolue hors ligne. | Hors ligne, le chiot est considéré au repos : +20/h jusqu'à 100. |
| D-12 | « Jour » d'absence | Affection −1 par jour d'absence ; le jour de jeu se termine à 4 h. | Un jour d'absence = chaque passage de 4 h du matin franchi sans session, dans la limite des 72 h prises en compte. |
| D-13 | Unité d'endurance | F-PRO-1 plafonne le trajet par l'endurance ; gains par 100 m. | 1 point d'endurance = 100 m. Départ : 5 (500 m). |
| D-14 | Tours combinés secrets | Comment les apprendre n'est pas précisé. | Ils exigent que le tour de base cité soit appris, puis se déclenchent comme un geste apprenable (ampoule) quand l'ordre de base est donné dans la posture indiquée. Ils comptent dans les 14 places. |
| D-15 | Schémas manquants | Les blocs « boucle de jeu », « états du chiot » et « architecture » n'ont pas survécu à l'export Markdown. | Les tableaux du texte suffisent ; on s'y tient. |
| D-16 | Race du jalon 1 | « Une seule race » sans préciser laquelle. | Beagle : taille moyenne et longues oreilles tombantes, qui donnent le plus d'expressivité à animer. |
| D-17 | Contenu de `npm run check` | « Lint, types et tests » ; Playwright demande un navigateur téléchargé. | `check` = ESLint + `tsc --noEmit` + Vitest. Les parcours Playwright tournent avec `npm run e2e`, lancé avant chaque fin de jalon. |
| D-18 | Jouer sur téléphone | Rien de prévu pour tester sur l'appareil. | Jalons 0 à 3 : serveur Vite ouvert au réseau local (même Wi-Fi). Le micro exige HTTPS hors `localhost` : on choisira au jalon 4 entre un certificat local et un hébergement statique. |
| D-19 | Points de maître | `SaveGame.masterPoints` est global, mais le plafond est « par chiot et par jour ». | Un seul compteur de points de maître pour le joueur ; le plafond de 200 est suivi par chiot dans `day`. Les déblocages lisent le compteur global. |
| D-21 | Technique du chiot articulé | La spec demande des parties séparées animées par le code, sans préciser la projection. | Marionnette 2,5D : chaque partie est un ellipsoïde en 3D, projeté par une caméra légèrement plongeante et trié en profondeur. Le chiot peut ainsi se tourner, s'asseoir, se coucher et se rouler sans dessin par angle de vue. Les taches de pelage sont des ellipsoïdes intérieurs, qui ne débordent jamais du contour. |
| D-22 | Pousser ou caresser | F-MAIN-1 et F-MAIN-6 sont deux glissements sur le corps. | La vitesse tranche : ≥ 38 px en moins de 220 ms depuis l'appui sur le flanc ou le ventre = poussée ; sinon caresse. La caresse réagit dès le premier pixel, pour tenir les 100 ms. |
| D-23 | Chiot du jalon 1 | Pas d'adoption avant le jalon 3. | Un beagle « joueur » est créé à la première session. Il sera remplacé par le chenil au jalon 3 ; la sauvegarde garde le même format. |
| D-24 | Souris et main présentée | F-MAIN-2 au doigt ou à la souris. | La souris compte comme une main tant qu'elle reste sur la scène, même immobile ; elle cesse de compter quand elle sort. |
| D-25 | Mesure de la latence | Critère « moins de 100 ms ». | Mesurée de l'événement pointeur (ou de la reconnaissance d'un maintien) à la première image rendue qui montre la réaction. Playwright lance Chromium avec le GPU, sinon le rendu logiciel tombe à ~12 images/s et fausse la mesure. |
| D-20 | Couche « core » | L'architecture de la spec n'a pas de place pour la boucle de jeu et le store. | Ajout de `src/core/` : boucle à pas fixe, store (état + actions), horloge et RNG concrets. `sim/` reste pur. |

## Dépendances

| Paquet | Pourquoi |
| --- | --- |
| `pixi.js` 8 | Rendu imposé par la spec. |
| `idb` | Sauvegarde IndexedDB imposée par la spec. |
| `vite`, `typescript` | Pile imposée. TypeScript 6.0 et non 7 : `typescript-eslint` ne gère pas encore la 7. |
| `vitest`, `@playwright/test` | Tests imposés par la spec. |
| `fake-indexeddb` (dev) | Tester `save/` sous Vitest sans navigateur. |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` (dev) | Le « lint » demandé par le jalon 0, et contrôle des règles d'import de `sim/`. |
| `vite-plugin-pwa` | Prévu au jalon 7, pas installé avant. |
