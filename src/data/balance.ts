/**
 * Toutes les valeurs d'équilibrage et de rythme du jeu.
 * Aucune valeur chiffrée de gameplay ne doit être écrite en dur ailleurs.
 */
export const BALANCE = {
  time: {
    /** Pas fixe de la simulation (SPEC, Temps et sauvegarde). */
    simStepMs: 100,
    /** Pas rattrapés au plus par image ; au-delà, le calcul hors ligne prend le relais. */
    maxCatchUpSteps: 10,
    /** Sauvegarde automatique (SPEC, Temps et sauvegarde). */
    autosaveIntervalMs: 30_000,
    /** Heure locale de remise à zéro des compteurs quotidiens. */
    dayResetHour: 4,
  },

  /** SPEC, Jauges : valeurs de départ. */
  start: {
    hunger: 80,
    thirst: 80,
    cleanliness: 90,
    energy: 100,
    affection: 30,
    stamina: 5,
  },

  /** SPEC, Tempérament. Un tirage ajoute ±jitter à chaque trait. */
  temperaments: {
    sage: { docility: 0.8, energy: 0.4, boldness: 0.5 },
    joueur: { docility: 0.5, energy: 0.9, boldness: 0.7 },
    timide: { docility: 0.6, energy: 0.4, boldness: 0.1 },
    tetu: { docility: 0.2, energy: 0.7, boldness: 0.8 },
  },
  traitJitter: 0.1,

  /** Comportement du chiot (SPEC, Choix de l'activité, et F-MAIN). */
  puppy: {
    decisionIntervalMs: 500,
    currentActivityBonus: 15,
    scoreNoise: 10,
    scores: {
      wander: 30,
      comeBase: 50,
      comePerAffection: 0.5,
      petted: 70,
      sulk: 60,
      spontaneousBase: 25,
      spontaneousPerEnergy: 0.25,
      /** L'accueil au retour passe avant tout, comme un ordre. */
      greet: 95,
    },
    /** Geste spontané : laissé seul plus de 20 s. */
    aloneForSpontaneousMs: 20_000,
    spontaneousDurationMs: 2600,

    /** F-MAIN-1 et D-05. */
    caress: { minStrokePx: 60, minIntervalMs: 2000, affectionGain: 1, dailyCap: 15 },
    /** Durée pendant laquelle une caresse est considérée comme en cours. */
    pettingHoldMs: 700,

    /** F-MAIN-2 : reniflement, puis léchage. */
    hand: { sniffMs: 900, lickIntervalMs: 650 },

    /** F-MAIN-3 et D-06. */
    taps: { windowMs: 1200, count: 2, lookBeforeComeMs: 450, callMs: 6000 },

    /** F-MAIN-4 et D-07. */
    pull: { windowMs: 10_000, repeatedCount: 3, affectionLoss: 1, sulkMs: 8000, backOffDistance: 0.3 },

    /** F-MAIN-5 : chance de s'asseoir quand la main se lève. */
    raise: { sitChanceBase: 0.35, sitChancePerDocility: 0.5, sitDelayMs: 600 },

    /** F-VIE-2 : seuils d'absence (ms) pour les intensités 1, 2 et 3 ; durées d'accueil. */
    greet: {
      thresholdsMs: [2 * 60_000, 30 * 60_000, 6 * 3_600_000],
      durationMs: [0, 2500, 4500, 7000],
    },

    /** Vitesses au sol, en unités de sol par seconde. */
    speeds: { walk: 0.2, trot: 0.42, run: 0.75 },

    /** Sol du salon : x de gauche à droite, z du fond (0) vers le joueur (1). */
    floor: { minX: -0.75, maxX: 0.75, minZ: 0.1, maxZ: 0.92, front: { x: 0, z: 0.88 }, home: { x: 0, z: 0.55 } },

    wander: { idleMinMs: 2500, idleMaxMs: 7000, walkChance: 0.55, sniffChance: 0.3 },

    /** Arrivée : distance sous laquelle le chiot est rendu. */
    arriveEpsilon: 0.02,
  },

  /** SPEC, Jauges : évolution des besoins. */
  needs: {
    perHour: { hunger: 4, thirst: 6, cleanliness: 1.5, energyAwake: 15, energyAsleep: 20 },
    meal: 40,
    water: 50,
    bath: 100,
    /** Seuils des mots (SPEC) : Excellent ≥ [0], Normal ≥ [1], À surveiller ≥ [2], sinon Urgent. */
    words: { hunger: [75, 40, 15], thirst: [75, 40, 15], cleanliness: [90, 40, 15] },
    /** D-08 : « besoin réel » = sous le niveau Excellent. */
    realNeed: { hunger: 75, thirst: 75, cleanliness: 90 },
    offline: { floor: 5, maxHours: 72, affectionPerDay: 1, affectionFloor: 20, energyRestPerHour: 20 },
    /** D-03 : la bouderie due à un besoin urgent attend 2 min de session. */
    sulkAfterUrgentMs: 120_000,
    /** Écart d'horloge au-delà duquel un pas de jeu est traité comme une absence. */
    gapAsOfflineMs: 5000,
  },

  /** F-VIE-1 et D-10. */
  sleep: {
    nightStartHour: 22,
    nightEndHour: 7,
    nightBonus: 40,
    /** Le sommeil est possible si l'énergie est basse, ou la nuit. */
    lowEnergy: 50,
    /** Laissé tranquille depuis tant de temps avant de s'endormir. */
    aloneMs: 20_000,
    /** Après un réveil, reste éveillé au moins ce temps sans interaction. */
    afterWakeMs: 60_000,
  },

  /** F-SOIN-1 à F-SOIN-3. */
  care: {
    eatMs: 3500,
    /** Le chiot se place derrière la gamelle, tête au-dessus. */
    bowlOffsetZ: 0.13,
    soapPx: 700,
    rinsePx: 500,
    dryPx: 600,
    brushPxPerStep: 150,
    brushStep: 5,
    brushMaxPerSession: 15,
    brushSessionGapMs: 60_000,
    shineMs: 10 * 60_000,
  },

  /** F-ADO. */
  adoption: {
    litterSize: 3,
    nameMaxLength: 12,
  },

  /** SPEC, Obéissance : P = base + docilité + affection + maîtrise − malus, bornée. */
  obedience: {
    base: 0.15,
    perDocility: 0.3,
    perAffection: 0.4,
    perMastery: 0.2,
    min: 0.1,
    max: 0.98,
    masteryStep: 0.05,
    malusUrgent: 0.2,
    malusTired: 0.15,
    tiredBelow: 20,
    malusSpam: 0.1,
    spamCount: 5,
    spamWindowMs: 60_000,
  },

  /** F-JEU. Unités : sol pour x et z, unités du chiot pour la hauteur. */
  toys: {
    scores: { fetchBase: 60, fetchPerEnergy: 0.25, fearBase: 90, fearPerBoldness: 80 },
    /** Un jouet « vient d'être lancé » pendant ce temps. */
    thrownMemoryMs: 12_000,
    energyPerThrow: 1,
    /** F-JEU-2 : chance de rapporter, sinon mâchouiller ou ignorer. */
    plan: { fetchBase: 0.15, fetchPerAffection: 0.45, fetchPerDocility: 0.3, fetchPerEnergyTrait: 0.15, chewPerEnergyTrait: 0.65 },
    gravity: { ball: 9, disc: 3.2, rope: 9 },
    bounce: 0.45,
    rollFriction: 1.4,
    discDrag: 0.3,
    maxSpeed: 2.4,
    /** Part de la vitesse du doigt transmise au jouet. */
    fingerSensitivity: 0.18,
    grabDistance: 0.07,
    chewMs: 6000,
    dropOffsetZ: 0.1,
    /** F-JEU-4 : habitué après tant d'approches. */
    familiarAfter: 3,
    fearMs: 2600,
    fearCooldownMs: 3000,
    timidBelow: 0.4,
    /** F-JEU-3. */
    tug: { winPx: 600, idleMs: 2000, yankEveryMs: 600, yankChance: 0.14 },
  },

  /** F-DRE. */
  training: {
    /** F-DRE-1 : l'ampoule reste 3 s. */
    bulbMs: 3000,
    /** F-DRE-2 : 3 à 6 répétitions selon le tempérament et l'affection. */
    repsMin: 3,
    repsMax: 6,
    /** F-DRE-5. */
    maxTricks: 14,
    newPerDay: 4,
    /** Score de l'activité « exécuter un ordre » (SPEC, prioritaire). */
    orderScore: 95,
    /** Après « Debout », il retombe assis au bout de ce temps. */
    begHoldMs: 4000,
  },

  /** SPEC, Reconnaissance vocale. */
  voice: {
    frameMs: 25,
    hopMs: 10,
    coeffs: 13,
    melFilters: 26,
    minHz: 100,
    maxHz: 7000,
    preEmphasis: 0.97,
    /** Enregistrement : 3 s au plus, parole d'au moins 150 ms. */
    maxMs: 3000,
    minSpeechMs: 150,
    /** Seuil de parole relatif au niveau le plus fort de l'enregistrement. */
    speechRatio: 0.08,
    /** Distance DTW normalisée en dessous de laquelle un ordre est reconnu. */
    acceptBelow: 5,
    /** Le meilleur doit être nettement meilleur que le deuxième (rapport maximal). */
    marginRatio: 0.8,
    /** À l'enregistrement, un ordre plus proche que cela d'un autre donne le « ? » bleu. */
    similarBelow: 3.5,
    /** Fenêtre de Sakoe-Chiba, en part de la longueur. */
    band: 0.35,
  },

  /** F-PRO. */
  walk: {
    /** Longueur d'une rue du plan. */
    edgeM: 50,
    /** D-13 : 1 point d'endurance = 100 m. */
    metersPerStamina: 100,
    /** F-PRO-7 : une promenade avec gains toutes les 30 minutes. */
    cooldownMs: 30 * 60_000,
    /** Vitesse de marche dans la vue de profil (le temps de jeu est raccourci). */
    speedMps: 8,
    /** F-PRO-4 : points « ? » sur le plan. */
    questionPoints: 3,
    hiddenGiftEveryM: 120,
    hiddenGiftChance: 0.45,
    poopChance: 0.8,
    /** F-PRO-6 : temps pour ramasser. */
    pickupMs: 6000,
    /** Un cadeau se ramasse si le chiot passe dans sa voie. */
    laneTolerance: 0.35,
    sparkleLeadM: 30,
    barkLeadM: 35,
    encounterMs: 4000,
    poopStopMs: 1800,
    /** SPEC, Gains : 10 points + 1 par 100 m ; ramasser +5, oublier −5. */
    points: { base: 10, per100m: 1, pickup: 5, forget: -5 },
    /** SPEC, Jauges : affection +3, propreté −10 par promenade. */
    affection: 3,
    cleanliness: -10,
    energy: -5,
    stamina: 1,
    /** La laisse tire le chiot vers la voie voulue ; il résiste moins s'il est docile. */
    leashPull: 2.4,
    wanderPull: 0.9,
  },

  /** F-ECO. */
  economy: {
    /** F-ECO-2 : plafond quotidien de points de maître par chiot (hors concours). */
    dailyPointsCap: 200,
    /** D-49 : pièces de départ, avant les concours. */
    welcomeCoins: 300,
    /** F-ECO-3 : la brocante change chaque jour. */
    marketSize: 6,
    marketPriceVariation: 0.2,
    /** Prix à la brocante d'un objet sans prix de boutique. */
    rarePriceFactor: 2.5,
  },

  /** F-CON. */
  contests: {
    /** SPEC, Gains : 1re / 2e / 3e place en Débutant. */
    points: [50, 30, 20],
    coins: [300, 150, 75],
    /** Multiplicateurs par classe, de Débutant à Champion. */
    pointsMult: [1, 2, 3, 5, 8],
    coinsMult: [1, 2, 4, 7, 12],
    /** F-CON-5 : un échec rapporte tout de même quelques points. */
    consolationPoints: 5,
    /** F-CON-4 : monter de classe après 2 podiums (ou une victoire). */
    podiumsToRise: 2,
    /** F-CON-6. */
    prizePerDay: 3,
    rivals: 5,
    /** Score des rivaux par classe : moyenne et écart (disque : points ; agilité : secondes ; obéissance : points). Un joueur parfait fait environ 380 au disque et 14 s en agilité.. */
    rivalScores: {
      disc: { mean: [70, 120, 170, 220, 280], spread: 0.3 },
      agility: { mean: [32, 27, 23, 20, 17], spread: 0.15 },
      obedience: { mean: [45, 65, 85, 105, 125], spread: 0.25 },
    },
    disc: {
      durationMs: 60_000,
      fieldM: 40,
      halfWidthM: 12,
      /** Vitesse du chiot : selon le trait d'énergie et l'énergie du moment. */
      dogSpeedMps: [6, 9.5],
      returnSpeedMps: 7,
      /** Attrapé en l'air : points = mètres × 1,5 ; ramassé au sol : × 0,4. */
      airMult: 1.5,
      groundMult: 0.4,
      catchHeightM: 1.6,
      catchRadiusM: 1.4,
      fingerSensitivity: 0.022,
      minSpeedMps: 4,
      maxSpeedMps: 22,
      /** Le disque plane : portance et gravité réduite. */
      startHeightM: 1.2,
      liftMps: 1.5,
      gravity: 1.8,
      drag: 0.25,
      /** Le chiot attend ici, près du joueur. */
      homeY: 2,
    },
    agility: {
      timeCapMs: 120_000,
      dogSpeedMps: [3.6, 5.2],
      /** Obstacle manqué ou refusé : pénalité. */
      penaltyS: 5,
      gateWidthM: 2.2,
      seesawSlow: 0.45,
      tunnelSlow: 0.8,
    },
    obedience: {
      orderMs: 7000,
      pointsPerTrick: 10,
      /** Bonus de rapidité, au plus, si l'ordre est donné aussitôt. */
      speedBonus: 8,
    },
  },

  /** F-ECO-2 : points de maître des soins et du dressage (SPEC, Gains). */
  gains: {
    meal: 5,
    groom: 10,
    trickRepeat: 2,
    newTrick: 30,
  },

  /** F-ECO : déblocages selon les points de maître. À 300, la corde du salon s'ouvre aussi (D-35). */
  unlocks: [
    { at: 300, items: ['ballon'], breeds: [], decor: null },
    { at: 2000, items: ['canape'], breeds: ['husky'], decor: null },
    { at: 6000, items: [], breeds: [], decor: 'seaside' },
    { at: 10_000, items: ['souris-meca'], breeds: ['caniche'], decor: null },
    { at: 18_000, items: [], breeds: [], decor: 'space' },
    { at: 30_000, items: [], breeds: ['corgi'], decor: null },
    { at: 50_000, items: [], breeds: ['dalmatien'], decor: null },
  ],

  /** F-VIE-4 et SPEC, Plusieurs chiens. */
  family: {
    maxHome: 3,
    maxHotel: 5,
    maxDogs: 8,
    /** Jouer ensemble : score, durée, attente avant une nouvelle partie. */
    playScore: 42,
    playMs: 6000,
    playCooldownMs: 25_000,
    playRange: 0.7,
    /** D-60 : à la pension, faim, soif et pelage ne descendent pas sous ce niveau. */
    hotelCare: 70,
  },

  /** Seuils des gestes (D-05 à D-07), en pixels CSS et millisecondes. */
  gestures: {
    tapMaxMovePx: 12,
    tapMaxMs: 300,
    pullMinPx: 22,
    pushMinPx: 38,
    pushMaxMs: 220,
    presentStillPx: 14,
    presentHoldMs: 450,
    raiseHoldMs: 200,
    /** « Lever vite la main » (Saut) : vitesse vers le haut en entrant au-dessus de la tête. */
    raiseFastPxPerS: 700,
    /** « Appuyer doucement sur le dos » (Couché). */
    pressHoldMs: 450,
    /** « Dessiner un cercle autour de lui » (Tourne) : part de tour et durée maximale. */
    circleTurns: 0.85,
    circleMaxMs: 2500,
  },
} as const;
