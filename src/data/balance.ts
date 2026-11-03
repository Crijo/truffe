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
} as const;
