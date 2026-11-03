# Cahier des charges – Jeu de chiot virtuel inspiré de Nintendogs

Nov 3, 2026 · @Johann

## Synthèse

Ce cahier des charges décrit **Truffe** (nom de travail) : un jeu web original où l'on élève un chiot, qui reprend les mécaniques de Nintendogs sans aucun de ses contenus. Il est écrit pour que Claude Code puisse le construire jalon par jalon, sans décision de conception supplémentaire.

Le cœur du jeu tient en une promesse : **le chiot doit sembler vivant et se souvenir de vous**. Tout le reste (concours, boutique, déblocages) sert à donner une raison de revenir chaque jour.

### Décisions par défaut

Ces choix sont des hypothèses de ma part. Chacun peut être changé avant de lancer le développement.

| Sujet | Décision | Raison |
| --- | --- | --- |
| Plateforme | Application web installable (PWA), tactile et souris | Aucune installation, proche du geste au stylet |
| Rendu | Chiot 2D dessiné par le code, articulé | Claude Code ne peut pas produire de modèles 3D ni de fourrure réalistes |
| Voix | Reconnaissance locale de la voix du joueur, avec boutons en secours | Reprend le cœur du jeu d'origine, sans envoi audio |
| Compte et réseau | Aucun : un joueur, sauvegarde locale | Réduit le périmètre et protège la vie privée |
| Animal | Chiens uniquement, 6 races au départ et 4 à débloquer | Les races sont paramétriques ; les chats viendront plus tard si le jeu plaît |
| Langue | Français, textes prêts pour la traduction | Public initial |

### Comment utiliser ce document

1. Exportez ce document en Markdown et placez-le à la racine d'un dossier vide sous le nom `SPEC.md`.
2. Ouvrez Claude Code dans ce dossier et collez le prompt de la section « Prompt pour Claude Code ».
3. Validez chaque jalon en jouant au jeu avant de demander le suivant.

## Analyse de Nintendogs

Nintendogs (Nintendo DS, 2005) n'a ni fin ni défaite : il repose sur l'attachement à un chiot crédible, entretenu par de courtes sessions réparties sur plusieurs jours. Les règles ci-dessous viennent de critiques d'époque et d'une copie de Wikipédia, et non d'une analyse du code du jeu.

&#91;embedded content: boucle de jeu · 6 étapes\]

Les besoins qui baissent avec le temps relancent la boucle, et les déblocages donnent une raison d'aller plus loin.

### Les systèmes du jeu

| Système | Fonctionnement d'origine | Rôle dans le jeu | Reprise |
| --- | --- | --- | --- |
| Adoption | 6 races au départ sur 18 ; chaque chiot a sa couleur et sa personnalité, parfois désobéissante ([GameSpot](https://gamespot.com/reviews/nintendogs-review/1900-6131604/)) | Créer un lien dès le choix | Oui |
| Main virtuelle | Le stylet caresse, tire la queue, soulève les oreilles ; le chiot lèche la main ([GamesFirst](https://gamesfirst.com/articles/2005/nintendogs-chihuahua-friends/)) | Source principale du charme | Oui, priorité 1 |
| Besoins | Faim, soif et propreté baissent avec l'horloge réelle ; une négligence prolongée fait fuguer le chien, qui finit par revenir ([Wikipédia](https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.4everland.io/wiki/Nintendogs.html)) | Raison de revenir | Oui, sans punition lourde |
| Dressage vocal | Le chiot fait un geste, une ampoule apparaît, on enregistre un ordre, puis on répète ([Nintendo World Report](https://nintendoworldreport.com/review/4394)) | Fierté du joueur | Oui |
| Promenade | On trace un trajet sur un plan ; l'endurance limite la distance et augmente avec la pratique ([GamesFirst](https://gamesfirst.com/articles/2005/nintendogs-chihuahua-friends/)) | Découverte et collection | Oui |
| Objets | Surprises trouvées dehors, à garder, revendre ou offrir ([Nintendo World Report](https://nintendoworldreport.com/review/4394)) | Curiosité | Oui, avec objets originaux |
| Concours | Disque, agilité, obéissance ; 5 classes ; un podium fait monter, sinon on redescend ([Wikipédia](https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.4everland.io/wiki/Nintendogs.html)) | Objectif et argent | Oui |
| Deux monnaies | L'argent achète ; les points d'entraîneur montent ou baissent et débloquent races et décors ([Wikipédia](https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.4everland.io/wiki/Nintendogs.html)) | Progression longue | Oui |
| Plusieurs chiens | 3 à la maison, 5 à l'hôtel, 8 au maximum ([Wikipédia](https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.4everland.io/wiki/Nintendogs.html)) | Renouveler l'intérêt | Oui, à partir du jalon 6 |
| Échange sans fil | Bark Mode : rencontre, cadeaux et déblocage de races entre consoles ([Nintendo World Report](https://nintendoworldreport.com/review/4394)) | Partage | Non en V1 |

### Les limites qui rythment le jeu

Ces limites étalent le jeu sur plusieurs semaines : [Nintendo World Report](https://nintendoworldreport.com/review/4394) relève 3 ou 4 tours appris par jour, 30 minutes entre deux promenades et 3 concours par jour. Un maximum de 14 tours par chien s'y ajoute, et le premier déblocage de race peut prendre une semaine.

### Ce qu'il faut retenir

- **Le comportement compte plus que le graphisme.** Les critiques louent les manières du chiot : yeux qui suivent le stylet, sieste soudaine, peur d'un objet inconnu.
- **Le chiot prend des initiatives.** Hurler, creuser ou renifler s'apprennent en le laissant faire et en saisissant le moment.
- **Les décors restent sobres.** La maison et la ville sont de simples fonds : l'effort porte sur le chiot.

### Défauts à corriger

| Défaut d'origine | Correction prévue |
| --- | --- |
| Reconnaissance vocale capricieuse et sensible à l'intonation | Plusieurs enregistrements par ordre, retour clair, boutons toujours possibles |
| Ordres qui se ressemblent et se confondent | Alerte à l'enregistrement, avec proposition de réessayer |
| Blocage frustrant lors d'une longue session ([GameSpot](https://gamespot.com/reviews/nintendogs-review/1900-6131604/)) | Le jeu libre reste illimité ; seuls les gains sont plafonnés |
| Peu de choses à faire une fois les concours maîtrisés | Carnet de collection et tours à découvrir |
| Descente de classe après un échec | Aucune descente : on garde sa classe |

Les seuils chiffrés de déblocage varient d'une version à l'autre, et les sources communautaires se contredisent. Ce cahier des charges fixe donc ses propres valeurs.

## Vision et périmètre

Truffe est un compagnon de poche : une session de 5 minutes doit déjà procurer le plaisir de retrouver son chiot, sans objectif imposé ni défaite possible.

- **Public :** dès 7 ans, y compris les personnes qui ne jouent jamais. Les textes restent simples et aucune lecture n'est nécessaire pour caresser le chiot.
- **Appareils :** téléphone en portrait en priorité, tablette et ordinateur ensuite.
- **Modèle :** gratuit, sans publicité, sans achat intégré et sans collecte de données.

### Périmètre

| Inclus en V1 | Reporté | Exclu |
| --- | --- | --- |
| 1 chiot, puis jusqu'à 3 à la maison | Chats | Compte et serveur |
| 10 races (6 au départ), couleurs et personnalités | Échange entre joueurs | Publicité et achats intégrés |
| Caresses, jeux, soins | Podomètre, réalité augmentée | Mort ou maladie du chiot |
| Dressage à la voix ou aux boutons | Mini-jeu de ville en 3D | Rendu 3D réaliste |
| Promenades, objets, 3 concours | Traductions | Portage sur console |

### Propriété intellectuelle

Le jeu s'inspire des mécaniques, mais ne reprend aucun contenu de Nintendo. Je ne suis pas juriste : avant toute diffusion publique, faites valider ce point par un professionnel.

- **Interdit :** le nom Nintendogs, les logos, images, sons, musiques, textes, personnages, objets Nintendo (chapeaux Mario, etc.) et les interfaces imitées à l'identique.
- **Autorisé par défaut :** les races de chien réelles, les activités canines courantes et des illustrations, sons et noms créés pour le projet.
- **À vérifier :** la disponibilité du nom « Truffe » avant publication.

## Spécifications fonctionnelles

Chaque exigence porte un identifiant pour que les jalons et les tests puissent s'y référer. Toutes les valeurs sont des valeurs de départ, regroupées dans un seul fichier d'équilibrage.

### Adoption (F-ADO)

- **F-ADO-1** Au premier lancement, le chenil présente 3 chiots tirés au hasard pour chacune des 6 races de départ.
- **F-ADO-2** Chaque chiot a une race, un pelage, un sexe et un tempérament visible (« joueur », « timide », « têtu », etc.).
- **F-ADO-3** Le joueur nomme le chiot au clavier. S'il autorise le micro, il prononce le nom 3 fois.
- **F-ADO-4** Le premier chiot est offert. Les suivants coûtent de 500 à 2 000 pièces selon la race.

### Interaction à la main (F-MAIN)

| ID | Geste | Réaction attendue |
| --- | --- | --- |
| F-MAIN-1 | Glisser sur la tête, le dos ou le ventre | Yeux mi-clos, queue rapide, affection en hausse |
| F-MAIN-2 | Présenter la main immobile près du museau | Reniflement, puis léchage |
| F-MAIN-3 | Toucher l'écran à répétition | Le chiot dresse les oreilles, regarde le point, puis vient |
| F-MAIN-4 | Tirer la queue ou les oreilles, doucement | Surprise ou jeu ; répété, le chiot recule et l'affection baisse |
| F-MAIN-5 | Lever la main au-dessus du museau | Le chiot suit des yeux et peut s'asseoir |
| F-MAIN-6 | Pousser le ventre ou le flanc | Le chiot se couche ou se roule sur le côté |

Le regard du chiot suit le doigt en permanence quand il est éveillé et attentif.

### Soins (F-SOIN)

- **F-SOIN-1** Poser une gamelle de nourriture ou d'eau par glisser-déposer ; le chiot s'en approche s'il en a besoin.
- **F-SOIN-2** Le bain se fait au doigt : savonner, rincer avec le pommeau, sécher à la serviette.
- **F-SOIN-3** La brosse s'utilise par glissements et fait briller le pelage.
- **F-SOIN-4** Une fiche indique en mots l'état du chiot : Faim, Soif et Pelage, jamais en pourcentage.
- **F-SOIN-5** Un chiot très négligé boude et refuse les concours. Il ne fugue pas et ne subit aucune perte définitive.

### Jouets (F-JEU)

- **F-JEU-1** Balle et disque se lancent d'un geste : la vitesse et la direction du doigt déterminent la trajectoire.
- **F-JEU-2** Le chiot rapporte l'objet si son humeur le permet, sinon il le mâchouille ou l'ignore.
- **F-JEU-3** La corde se joue en tirant : le chiot résiste, secoue la tête, puis lâche ou gagne.
- **F-JEU-4** Un objet inconnu peut effrayer un chiot timide, qui s'y habitue après quelques approches.

### Dressage (F-DRE)

- **F-DRE-1** Quand le chiot fait un geste qu'il peut apprendre, une ampoule apparaît pendant 3 secondes. Le joueur la touche pour lui associer un ordre.
- **F-DRE-2** Un tour s'apprend en 3 à 6 répétitions selon le tempérament et l'affection.
- **F-DRE-3** Le jeu affiche trois retours distincts : ampoule au-dessus de la tête (progrès), point d'interrogation rouge (ordre mal compris), point d'interrogation bleu (ordre trop proche d'un autre).
- **F-DRE-4** Un ordre appris est exécuté selon une probabilité d'obéissance (voir la section suivante).
- **F-DRE-5** Limites : 14 tours par chien et 4 nouveaux tours par jour. Répéter les tours connus reste illimité.
- **F-DRE-6** Tout ordre peut être réenregistré ou supprimé depuis la fiche du chiot.

| Tour | Comment le provoquer | Catégorie |
| --- | --- | --- |
| Assis | Lever la main au-dessus du museau | Base |
| Couché | Appuyer doucement sur le dos | Base |
| Roulade | Pousser le flanc d'un chiot couché | Base |
| Donne la patte | Toucher une patte avant | Base |
| Debout | Lever la main d'un chiot assis | Base |
| Saut | Lever vite la main d'un chiot debout | Base |
| Tourne | Dessiner un cercle autour de lui | Base |
| Hurlement | Spontané, si on le laisse tranquille | Spontané |
| Creuser | Spontané, si on le laisse tranquille | Spontané |
| Renifler | Spontané, si on le laisse tranquille | Spontané |
| Aboyer | Spontané, si on le laisse tranquille | Spontané |
| Se gratter | Spontané, si on le laisse tranquille | Spontané |
| Salto | Ordre « saut » sur un chiot assis | Combiné secret |
| Poirier | Ordre « debout » sur un chiot couché | Combiné secret |
| Faire le mort | Ordre « roulade » sur un chiot déjà sur le côté | Combiné secret |
| Danser | Ordre « tourne » sur un chiot debout | Combiné secret |

Le jeu propose 16 tours pour 14 places : le joueur doit donc choisir, et peut oublier un tour pour en apprendre un autre.

### Promenade (F-PRO)

- **F-PRO-1** Le joueur trace au doigt un trajet sur un plan, plafonné par l'endurance du chiot.
- **F-PRO-2** Le trajet peut passer par 3 lieux : le parc (disque), le gymnase (agilité) et la brocante (boutique tournante).
- **F-PRO-3** Pendant la marche, vue de profil sur un décor défilant. Le joueur tire la laisse pour éviter ou attirer le chiot vers un élément.
- **F-PRO-4** Le plan affiche des points « ? » : cadeau ou rencontre avec un chien voisin. Un aboiement signale un cadeau, deux une rencontre.
- **F-PRO-5** Des cadeaux non indiqués apparaissent : il faut tirer la laisse à temps pour les récupérer.
- **F-PRO-6** Le chiot s'arrête pour faire ses besoins ; ramasser rapporte des points, oublier en retire un peu.
- **F-PRO-7** Une promenade toutes les 30 minutes rapporte des gains. L'endurance gagne 1 point par promenade terminée.

### Concours (F-CON)

Chaque concours se déroule en temps réel et se joue dans 5 classes : Débutant, Ouvert, Expert, Maître et Champion. Il est accessible après une visite au lieu d'entraînement correspondant.

| ID | Concours | Déroulement | Score |
| --- | --- | --- | --- |
| F-CON-1 | Disque | 1 minute, lancers au geste sur un terrain | Distance et difficulté des attrapés |
| F-CON-2 | Agilité | Parcours guidé au doigt : haies, tunnel, slalom, balançoire | Temps, moins les pénalités |
| F-CON-3 | Obéissance | Enchaînement imposé d'ordres, à la voix ou aux boutons | Tours réussis et rapidité |

- **F-CON-4** Un podium rapporte une coupe et de l'argent. Le chiot passe à la classe supérieure à sa première place ou après 2 podiums.
- **F-CON-5** Un échec ne fait pas descendre de classe et rapporte tout de même quelques points.
- **F-CON-6** Chaque chiot peut gagner des prix dans 3 concours par jour. Au-delà, il concourt pour le plaisir, sans gain.
- **F-CON-7** Un chiot très sale ou affamé ne peut pas s'inscrire ; le jeu explique pourquoi en une phrase.

### Économie et progression (F-ECO)

- **F-ECO-1** Deux compteurs : les **pièces** (achats) et les **points de maître** (progression, jamais dépensés).
- **F-ECO-2** Les points de maître récompensent les soins, les promenades et les concours, avec un plafond de 200 points par chiot et par jour.
- **F-ECO-3** Une boutique propose nourriture, jouets, accessoires et soins. La brocante change chaque jour et rachète les objets.
- **F-ECO-4** Un carnet de collection recense objets et tours, et montre des silhouettes pour ceux qui restent à découvrir.

| Points de maître | Déblocage |
| --- | --- |
| 300 | Corde et ballon |
| 2 000 | Race n° 7, canapé |
| 6 000 | Décor « Bord de mer » |
| 10 000 | Race n° 8, jouet mécanique |
| 18 000 | Décor « Espace » |
| 30 000 | Race n° 9 |
| 50 000 | Race secrète |

### Vie quotidienne (F-VIE)

- **F-VIE-1** Le chiot dort la nuit selon l'heure locale. Le joueur peut le réveiller, sans pénalité.
- **F-VIE-2** Au retour du joueur, le chiot accourt, avec une intensité qui dépend de l'absence.
- **F-VIE-3** Après plusieurs jours d'absence, les besoins sont bas, mais le chiot redevient joyeux en une session.
- **F-VIE-4** Plusieurs chiots à la maison jouent, se mordillent et dorment ensemble. Les autres attendent à la pension (5 places).

## Modèle de simulation

Le chiot est piloté par des jauges cachées et un choix d'activité par score : ce mélange le rend réactif sans être prévisible. Le joueur ne voit jamais les chiffres, seulement les comportements et les mots de la fiche.

### Jauges

Toutes les jauges vont de 0 à 100.

| Jauge | Départ | Évolution | Hausse |
| --- | --- | --- | --- |
| Faim | 80 | −4 par heure | +40 par repas |
| Soif | 80 | −6 par heure | +50 par gamelle |
| Propreté | 90 | −1,5 par heure ; −10 par promenade | 100 après un bain |
| Énergie | 100 | −15 par heure d'activité ; −1 par lancer | +20 par heure de sommeil |
| Affection | 30 | −1 par jour d'absence, plancher à 20 | +1 par caresse (plafond 15 par jour), +3 par promenade |

Hors ligne, faim, soif et propreté ne descendent jamais sous 5, et seules les 72 dernières heures comptent.

| Mot affiché | Faim | Soif | Pelage |
| --- | --- | --- | --- |
| Excellent | 75 et plus (« Repu ») | 75 et plus (« Désaltéré ») | 90 et plus (« Superbe ») |
| Normal | 40 à 74 | 40 à 74 | 40 à 89 |
| À surveiller | 15 à 39 (« A faim ») | 15 à 39 (« A soif ») | 15 à 39 (« Sale ») |
| Urgent | Moins de 15 (« Affamé ») | Moins de 15 (« Assoiffé ») | Moins de 15 (« Très sale ») |

Le seuil d'inscription aux concours (F-CON-7) correspond au niveau « Urgent » en faim ou en pelage.

### Tempérament

Chaque chiot reçoit à l'adoption trois traits fixes, entre 0 et 1, et une étiquette qui les résume.

| Étiquette | Docilité | Énergie | Audace |
| --- | --- | --- | --- |
| Sage | 0,8 | 0,4 | 0,5 |
| Joueur | 0,5 | 0,9 | 0,7 |
| Timide | 0,6 | 0,4 | 0,1 |
| Têtu | 0,2 | 0,7 | 0,8 |

Un tirage ajoute ±0,1 à chaque trait, pour que deux chiots ne soient jamais identiques.

### Obéissance

La probabilité d'exécuter un ordre reconnu se calcule ainsi, puis reste bornée entre 0,10 et 0,98 :

```latex
P = 0{,}15 + 0{,}30 \cdot \text{docilit\'e} + 0{,}40 \cdot \frac{\text{affection}}{100} + 0{,}20 \cdot \text{ma\^itrise} - \text{malus}
```

- **Maîtrise :** de 0 à 1 par tour, +0,05 à chaque exécution réussie.
- **Malus :** 0,20 si la faim ou la soif est au niveau « Urgent », 0,15 si l'énergie est sous 20, et 0,10 après 5 ordres en moins d'une minute.
- **Exemple :** un chiot têtu (docilité 0,2) avec une affection de 50 et une maîtrise de 0,5 obtient P = 0,15 + 0,06 + 0,20 + 0,10 = 0,51.

En cas d'échec, le chiot n'ignore pas seulement l'ordre : il regarde ailleurs, bâille ou part renifler.

### Choix de l'activité

Toutes les 500 ms, le chiot attribue un score à chaque activité et choisit la meilleure. Un bonus de 15 points pour l'activité en cours évite qu'il change sans cesse d'avis. Une part aléatoire de ±10 points garde des surprises.

| État | Se déclenche quand | Score de départ |
| --- | --- | --- |
| Manger ou boire | Une gamelle est servie et le besoin dépasse le seuil | 100 − jauge |
| Dormir | Énergie basse, ou nuit | 100 − énergie, +40 la nuit |
| Exécuter un ordre | Un ordre est reconnu et le tirage d'obéissance réussit | 95, prioritaire |
| Venir | Le joueur appelle ou touche l'écran | 50 + affection ÷ 2 |
| Rapporter | Un jouet vient d'être lancé | 60 + énergie ÷ 4 |
| Être caressé | La main est sur le chiot | 70 |
| Prendre peur | Objet inconnu et audace faible | 90 − audace × 80 |
| Bouder | Besoin urgent ou tirages répétés de queue | 60 |
| Geste spontané | Laissé seul plus de 20 secondes | 25 + énergie ÷ 4 |
| Flâner | Toujours possible | 30 |

&#91;embedded content: états du chiot · 10 activités\]

Le schéma simplifie les transitions : le score peut aussi faire passer directement d'une activité à une autre.

Les interruptions suivent un ordre simple : ordre, puis peur, puis besoin vital. Le sommeil ne s'interrompt que si le joueur touche le chiot ou l'appelle.

### Gains

| Action | Points de maître | Pièces |
| --- | --- | --- |
| Repas ou eau, si besoin réel | 5 | 0 |
| Bain ou brossage, si besoin réel | 10 | 0 |
| Ramasser les besoins | 5 | 0 |
| Oublier de ramasser | −5 | 0 |
| Promenade terminée | 10 + 1 par 100 m | 0 |
| Répétition réussie d'un tour connu | 2 | 0 |
| Nouveau tour appris | 30 | 0 |
| Concours, 1re / 2e / 3e place en Débutant | 50 / 30 / 20 | 300 / 150 / 75 |
| Multiplicateur par classe (de Débutant à Champion) | ×1 / ×2 / ×3 / ×5 / ×8 | ×1 / ×2 / ×4 / ×7 / ×12 |

Le plafond de 200 points par chiot et par jour s'applique à tous les gains, sauf aux concours. Un test d'équilibrage automatique doit vérifier qu'une session quotidienne de 15 minutes débloque la race n° 7 en 7 à 10 jours.

## Interface, direction artistique et audio

L'écran appartient au chiot : il occupe la scène, l'interface se réduit à quelques icônes et aucune barre de jauge n'est affichée.

### Écrans

| Écran | Contenu | Accès |
| --- | --- | --- |
| Salon | Chiot plein écran, barre basse : Sac, Sortir, Micro, Fiche | Écran d'accueil |
| Chenil | Choix de la race, puis des chiots | Premier lancement, ou Sortir |
| Sac | Nourriture, jouets, soins et accessoires par glisser-déposer | Salon |
| Fiche du chiot | État en mots, tours appris, coupes | Salon |
| Plan de ville | Tracé du trajet, lieux, points « ? » | Sortir |
| Promenade | Vue de profil, laisse au doigt | Plan |
| Parc et gymnase | Entraînement libre | Trajet |
| Boutique et brocante | Achat et revente | Sortir ou trajet |
| Concours | Inscription, épreuve, podium | Sortir |
| Carnet | Collection d'objets et de tours | Fiche |
| Réglages | Micro, volumes, sauvegarde, confidentialité | Salon |

### Contrôles

- Tous les gestes fonctionnent au doigt et à la souris, avec les pointer events.
- Toute action vocale a un équivalent à l'écran : un bouton Micro à maintenir et une liste d'ordres.
- Les cibles tactiles mesurent au moins 44 × 44 px.
- Les textes sont accompagnés d'une icône, pour les jeunes enfants.

### Direction artistique

Le style est celui d'un livre illustré : formes rondes, aplats doux, contour léger et grands yeux expressifs. Il ne cherche pas le réalisme et ne doit pas ressembler aux modèles de Nintendo.

- **Chiot articulé :** tête, oreilles, yeux, paupières, museau, langue, corps, 4 pattes et queue sont des parties séparées, animées par le code.
- **Races paramétriques :** une race est un jeu de paramètres : taille, longueur de museau, forme d'oreille, pelage, queue.
- **Animations minimales :** respiration, clignement, regard, queue selon l'humeur, marche, course, assis, couché, roulade, saut, léchage, secouage, bâillement, sommeil.
- **Décors :** fonds simples et légers qui changent discrètement selon l'heure.

| Race de départ | Silhouette |
| --- | --- |
| Labrador | Moyenne, oreilles tombantes |
| Teckel | Basse et longue |
| Chihuahua | Petite, grandes oreilles dressées |
| Berger allemand | Grande, oreilles dressées |
| Carlin | Compacte, museau court |
| Beagle | Moyenne, longues oreilles |

À débloquer : husky (n° 7), caniche (n° 8), corgi (n° 9) et dalmatien (race secrète).

### Audio

- Sons recherchés : aboiements, gémissements, halètement, bâillement, reniflement, et quelques ambiances discrètes.
- Origine : uniquement des sons créés pour le projet ou sous licence CC0, recensés avec leur source dans `ASSETS.md`.
- En leur absence, le jeu utilise des sons de synthèse Web Audio, afin de rester jouable.
- La musique reste légère, en boucle courte, et se coupe séparément des effets sonores.

### Accessibilité et confidentialité

- Réglage « réduire les animations », contrastes conformes à WCAG AA et jeu possible sans le son.
- Le micro n'est demandé qu'au premier dressage vocal, avec une explication préalable.
- Aucun son ne quitte l'appareil. Seules les empreintes vocales sont conservées, et elles peuvent être effacées dans les réglages.

## Spécifications techniques

Le jeu est une application statique sans serveur, et sa logique est séparée de l'affichage : la simulation peut ainsi être testée et accélérée sans navigateur.

### Pile technique

| Besoin | Choix | Note |
| --- | --- | --- |
| Langage | TypeScript en mode strict | Pas de `any` sans justification |
| Construction | Vite, module PWA | Fonctionne hors ligne une fois installé |
| Rendu | PixiJS (dernière version stable) | Parties du chiot en `Graphics` |
| Sauvegarde | IndexedDB (bibliothèque `idb`) | Sauvegarde automatique et export JSON |
| Audio | Web Audio API | Sons et analyse du micro |
| Voix | `getUserMedia`, MFCC, DTW | Local, voir plus bas |
| Tests | Vitest et Playwright | Unitaires et parcours de bout en bout |

Toute autre dépendance doit être justifiée dans `DECISIONS.md`.

### Architecture

```text
src/
  sim/        Logique pure, sans dépendance au navigateur
    needs.ts  personality.ts  obedience.ts  behavior.ts
    tricks.ts  walk.ts  contests.ts  economy.ts  offline.ts
  data/       Fichiers de contenu et d'équilibrage
    balance.ts  breeds.ts  items.ts  tricks.ts
  render/     PixiJS : chiot articulé, animations, scènes
  input/      Gestes, reconnaissance vocale
  audio/      Sons et musique
  ui/         Écrans et menus
  save/       Lecture, écriture, migrations
  main.ts
tests/        Tests de simulation et de parcours
```

&#91;embedded content: architecture · 7 modules\]

Règles de dépendance :

- `sim/` n'importe que `data/`, et n'accède jamais au DOM, à l'horloge ni à `Math.random`.
- Le temps et le générateur aléatoire à graine sont passés en paramètres, pour des tests reproductibles.
- `render/` et `ui/` lisent l'état et envoient des actions. Ils ne le modifient jamais directement.
- Toute valeur d'équilibrage vit dans `data/balance.ts`.

### Modèle de données

```ts
interface SaveGame {
  version: number;
  createdAt: number;
  lastSeenAt: number;       // horloge la plus récente jamais vue
  coins: number;
  masterPoints: number;
  inventory: Record<ItemId, number>;
  discovered: { items: ItemId[]; tricks: TrickId[] };
  dogs: Dog[];              // 8 au maximum
  homeDogIds: DogId[];      // 3 au maximum
  day: DailyCounters;       // remis à zéro à 4 h du matin
  settings: Settings;
}

interface Dog {
  id: DogId;
  name: string;
  breedId: BreedId;
  coat: CoatParams;
  traits: { docility: number; energy: number; boldness: number };
  needs: { hunger: number; thirst: number; cleanliness: number; energy: number };
  affection: number;
  stamina: number;
  tricks: LearnedTrick[];   // 14 au maximum
  contestClass: Record<ContestId, 0 | 1 | 2 | 3 | 4>;
  trophies: Trophy[];
  voiceName?: VoiceTemplate[];
  equipped: ItemId[];
}

interface LearnedTrick {
  trickId: TrickId;
  repetitions: number;
  learned: boolean;
  mastery: number;
  command: { label: string; voice?: VoiceTemplate[] };
}
```

### Temps et sauvegarde

- La simulation avance à pas fixe de 100 ms ; le rendu s'adapte à l'écran.
- Au retour, `offline.ts` applique en un seul calcul le temps écoulé, avec le plancher et le plafond définis plus haut.
- Une horloge qui recule n'accorde aucun gain et ne modifie aucun besoin. Le plafond quotidien s'appuie sur `lastSeenAt`.
- La sauvegarde se déclenche toutes les 30 secondes, à chaque événement important et quand la page passe en arrière-plan.
- Chaque changement de format passe par une migration testée.
- En cas de corruption, le jeu recharge la sauvegarde précédente : deux copies sont conservées.

### Reconnaissance vocale

Le joueur peut prononcer n'importe quel mot, dans n'importe quelle langue, car le jeu compare sa voix à ses propres enregistrements et ne transcrit rien. La Web Speech API n'est pas utilisée : son support varie et l'audio peut être envoyé à un service externe.

1. Enregistrer tant que le volume dépasse le seuil de parole, 3 secondes au maximum.
2. Extraire 13 coefficients MFCC par fenêtre de 25 ms, avec un pas de 10 ms.
3. Comparer à chaque modèle enregistré avec la distance DTW, normalisée par la longueur.
4. Retenir le meilleur résultat s'il passe sous le seuil de confiance et s'il est nettement meilleur que le deuxième.
5. Sinon, afficher le point d'interrogation rouge.

À l'enregistrement, un ordre trop proche d'un ordre existant déclenche le point d'interrogation bleu. Chaque ordre conserve jusqu'à 5 modèles, et le jeu ajoute les exemples bien reconnus. Sans micro, le jeu reste entièrement jouable avec la liste d'ordres.

### Performance et compatibilité

| Critère | Cible |
| --- | --- |
| Fluidité | 60 images par seconde sur un téléphone milieu de gamme de 2022 ; jamais sous 30 |
| Premier affichage | Moins de 3 secondes en 4G |
| Poids initial | Moins de 2 Mo hors sons |
| Navigateurs | Dernières versions de Chrome, Safari, Firefox et Edge |
| Reconnaissance | Réponse en moins de 300 ms après la fin de la parole |

### Tests

- **Simulation :** chaque règle chiffrée de ce document a son test.
- **Temps :** absence de 1 heure, 3 jours et 30 jours ; horloge reculée ; changement de jour.
- **Équilibrage :** un script simule 30 jours de joueurs types et vérifie le rythme de déblocage.
- **Voix :** tests de MFCC et DTW sur des signaux générés, puis grille de test manuelle sur appareil réel.
- **Parcours :** adoption, caresse, repas, promenade et concours avec Playwright.

## Plan de développement

Le développement avance en 8 jalons, et le jalon 1 doit déjà faire sourire : si le chiot n'attendrit pas à ce stade, tout le reste doit attendre. Chaque jalon se termine par un jeu jouable, des tests au vert et une validation par le joueur.

### Jalon 0 : socle

Exigences : projet, outils, boucle de jeu et sauvegarde.

- [ ] Le projet démarre avec une seule commande et affiche une scène vide en plein écran sur téléphone.
- [ ] Lint, vérification de types et tests passent avec `npm run check`.
- [ ] Une valeur enregistrée survit au rechargement de la page.

### Jalon 1 : le chiot vivant

Exigences : F-MAIN, F-VIE-2, chiot articulé paramétrique et sons de base. Une seule race.

- [ ] Le chiot respire, cligne des yeux, suit le doigt du regard et flâne seul.
- [ ] Les 6 gestes de F-MAIN produisent leur réaction en moins de 100 ms.
- [ ] Un observateur peut deviner l'humeur du chiot sans texte, avec au moins 3 humeurs distinctes.
- [ ] Le chiot accourt au retour du joueur.

### Jalon 2 : besoins et temps

Exigences : F-SOIN, F-VIE-1, F-VIE-3, jauges et calcul hors ligne.

- [ ] Les jauges respectent les valeurs du tableau, aussi bien en jeu qu'hors ligne.
- [ ] Repas, eau, bain et brossage fonctionnent au geste et modifient la fiche.
- [ ] Une absence de 30 jours ne laisse aucune jauge sous 5 et le chiot redevient joyeux en une session.
- [ ] Reculer l'horloge n'apporte aucun avantage.

### Jalon 3 : adoption et jeu

Exigences : F-ADO, F-JEU, 6 races, tempéraments et activités par score.

- [ ] Le premier lancement mène de l'adoption au salon en moins de 2 minutes.
- [ ] Les 6 races se distinguent à leur seule silhouette.
- [ ] Le lancer suit le geste du joueur, et le chiot rapporte, mâchouille ou ignore le jouet.
- [ ] Un chiot têtu et un chiot sage se comportent différemment sur une simulation de 100 ordres.

### Jalon 4 : dressage

Exigences : F-DRE, obéissance, puis reconnaissance vocale.

- [ ] Les 16 tours peuvent être appris ; les limites de 14 tours et de 4 tours par jour sont respectées.
- [ ] Le dressage aux boutons fonctionne de bout en bout avant toute intégration du micro.
- [ ] Sur 5 ordres et 20 essais dans une pièce calme, au moins 80 % sont bien reconnus sur appareil réel.
- [ ] Refuser le micro ne bloque aucune fonction.

### Jalon 5 : promenade et objets

Exigences : F-PRO, F-ECO-3, F-ECO-4, boutique, brocante et carnet.

- [ ] Le tracé respecte l'endurance et le délai de 30 minutes entre deux promenades avec gains.
- [ ] Cadeaux, rencontres et besoins apparaissent de façon reproductible à partir d'une graine.
- [ ] Au moins 30 objets originaux sont disponibles, sans objet emprunté à une marque.
- [ ] Acheter, revendre et équiper un objet fonctionne après rechargement.

### Jalon 6 : concours et progression

Exigences : F-CON, F-ECO-1, F-ECO-2, déblocages, plusieurs chiots et F-VIE-4.

- [ ] Les 3 concours et les 5 classes sont jouables, y compris avec un seul doigt.
- [ ] Le script d'équilibrage confirme le déblocage de la race n° 7 en 7 à 10 jours.
- [ ] Trois chiots cohabitent à 60 images par seconde sur l'appareil cible, et la pension fonctionne.

### Jalon 7 : finition

Exigences : PWA, accessibilité, audio final, compatibilité, performance, et export et import de la sauvegarde.

- [ ] Le jeu s'installe et se lance sans réseau.
- [ ] Les cibles de performance sont mesurées et notées dans `PERF.md`.
- [ ] `ASSETS.md` indique l'origine de chaque image et de chaque son.
- [ ] Une recherche dans le dépôt ne trouve aucune mention de Nintendo ou de ses marques, hors de `SPEC.md`.

## Prompt pour Claude Code

Collez ce texte dans Claude Code une fois `SPEC.md` en place. Le prompt limite volontairement la première session au jalon 0, puis au jalon 1 après votre accord.

```text
Tu développes Truffe, un jeu web de chiot virtuel décrit dans SPEC.md.

Avant d'écrire du code :
1. Lis SPEC.md en entier.
2. Crée CLAUDE.md : règles d'architecture, commandes du projet et jalon en cours.
3. Liste les ambiguïtés ou contradictions du document. Pose-moi uniquement les questions qui bloquent ; pour le reste, choisis et note ta décision dans DECISIONS.md.

Règles de travail :
- Travaille un jalon à la fois, dans l'ordre. Commence par le jalon 0.
- Respecte les identifiants d'exigence (F-MAIN-1, etc.) dans les tests et les commits.
- Écris d'abord les tests de la logique de sim/, puis le code.
- Place toutes les valeurs d'équilibrage dans src/data/balance.ts.
- Ne reprends ni nom, ni image, ni son, ni texte, ni objet de Nintendogs ou de Nintendo. Crée tout le contenu pour ce projet et note chaque origine dans ASSETS.md.
- Ne présente un jalon comme terminé qu'après avoir exécuté npm run check et vérifié ses critères d'acceptation dans un navigateur.

À la fin de chaque jalon :
- Résume ce qui a été fait, critère par critère.
- Indique comment y jouer sur mon téléphone.
- Liste ce que je dois vérifier moi-même, surtout le ressenti et la voix.
- Arrête-toi et attends mon accord avant le jalon suivant.

Pour le jalon 1, soigne d'abord le comportement et les animations du chiot : c'est le cœur du jeu.
```

## Sources

Pages consultées le 3 novembre 2026. Tous les chiffres d'équilibrage de Truffe sont des propositions, et non des valeurs issues du jeu d'origine.

- [Critique de Nintendogs, Nintendo World Report](https://nintendoworldreport.com/review/4394)
- [Critique de Nintendogs, GameSpot](https://gamespot.com/reviews/nintendogs-review/1900-6131604/)
- [Critique de Nintendogs: Chihuahua & Friends, GamesFirst](https://gamesfirst.com/articles/2005/nintendogs-chihuahua-friends/)
- [Nintendogs, copie archivée de Wikipédia](https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.4everland.io/wiki/Nintendogs.html)
