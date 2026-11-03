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

/** F-ADO-2 : étiquettes visibles du tempérament. */
export const TEMPERAMENT_LABELS = { sage: 'Sage', joueur: 'Joueur', timide: 'Timide', tetu: 'Têtu' } as const;
export const TEMPERAMENT_HINTS = {
  sage: 'calme et obéissant',
  joueur: 'plein d’énergie',
  timide: 'un peu craintif',
  tetu: 'n’en fait qu’à sa tête',
} as const;
export const SEX_LABELS = { f: 'Femelle', m: 'Mâle' } as const;

/** Idées de noms proposées au chenil (créées pour Truffe). */
export const NAME_IDEAS = ['Noisette', 'Biscotte', 'Pistache', 'Caramel', 'Moka', 'Praline', 'Filou', 'Grelot', 'Pompon', 'Câline', 'Tartine', 'Galopin', 'Réglisse', 'Crumble', 'Bouchon', 'Plume'];

export const NAME_ERRORS = { empty: 'Écris un nom.', long: 'Ce nom est trop long.', chars: 'Seulement des lettres, s’il te plaît.' } as const;

export const KENNEL = {
  title: 'Le chenil',
  chooseBreed: 'Choisis une race',
  chooseDog: 'Choisis ton chiot',
  pick: 'Choisir',
  back: 'Retour',
  nameTitle: 'Comment s’appelle ton chiot ?',
  nameHint: 'Touche une idée ou écris son nom',
  adopt: 'Adopter',
  free: 'Offert',
  coins: 'pièces',
  renameTitle: 'Ton chiot n’a pas encore de nom',
} as const;

export const TOY_LABELS = { ball: 'Balle', disc: 'Disque', rope: 'Corde' } as const;
export const TOY_HINT = 'Prends-la et lance-la d’un geste';

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
