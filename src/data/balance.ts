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
  },
} as const;
