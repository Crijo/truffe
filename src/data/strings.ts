/** Textes affichés, regroupés pour une future traduction. */

export type NeedKind = 'hunger' | 'thirst' | 'cleanliness';
export type NeedLevel = 'excellent' | 'normal' | 'watch' | 'urgent';

/** F-SOIN-4 : l'état en mots (SPEC, tableau des mots ; D-26 pour le niveau Normal). */
export const NEED_WORDS: Record<NeedKind, Record<NeedLevel, string>> = {
  hunger: { excellent: 'Repu', normal: 'Ça va', watch: 'A faim', urgent: 'Affamé' },
  thirst: { excellent: 'Désaltéré', normal: 'Ça va', watch: 'A soif', urgent: 'Assoiffé' },
  cleanliness: { excellent: 'Superbe', normal: 'Propre', watch: 'Sale', urgent: 'Très sale' },
};

export const NEED_LABELS: Record<NeedKind, string> = {
  hunger: 'Faim',
  thirst: 'Soif',
  cleanliness: 'Pelage',
};

export const UI = {
  bag: 'Sac',
  out: 'Sortir',
  mic: 'Micro',
  card: 'Fiche',
  soon: 'Bientôt',
  close: 'Fermer',
  food: 'Croquettes',
  water: 'Eau',
  brush: 'Brosse',
  bath: 'Bain',
  soap: 'Savon',
  shower: 'Douche',
  towel: 'Serviette',
  done: 'Fini',
  dragHint: 'Glisse sur le sol',
  puppy: 'Ton chiot',
  asleep: 'Il dort',
} as const;
