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

export const TRAINING = {
  ordersTitle: 'Donne un ordre',
  call: 'Viens !',
  noTricks: 'Ton chiot ne connaît encore aucun tour. Quand une ampoule s’allume au-dessus de sa tête, touche-la !',
  holdMic: 'Garde le bouton Micro appuyé et parle pour donner un ordre à la voix.',
  noMic: 'Sans micro, touche simplement l’ordre voulu.',
  tricksTitle: 'Tours',
  rename: 'Renommer',
  forget: 'Oublier',
  forgetSure: 'Sûr ?',
  record: 'Voix',
  reRecord: 'Revoix',
  recordName: 'Son nom à voix haute',
  reName: 'Redire son nom',
  clearVoices: 'Effacer les voix',
  learnedToast: 'Il a appris un nouveau tour !',
  bulbHint: 'Touche l’ampoule !',
  limitToast: 'Il a assez appris pour aujourd’hui.',
} as const;

export const VOICE = {
  askTitle: 'Parler à ton chiot',
  askText: 'Truffe peut reconnaître ta voix. Le son reste sur ton appareil : seule une empreinte de ta voix est gardée, et tu peux l’effacer quand tu veux.',
  allow: 'Utiliser le micro',
  later: 'Plus tard',
  denied: 'Micro refusé : tout reste possible avec les boutons.',
  recordTitle: 'Dis l’ordre',
  recordNameTitle: 'Dis son nom',
  hold: 'Appuie, parle, relâche',
  again: 'Encore une fois',
  done: 'Fini',
  tooClose: 'Ce mot ressemble trop à « {other} ». Essaie un autre mot.',
  tooShort: 'Je n’ai rien entendu. Parle un peu plus fort.',
  saved: 'Enregistré',
  notUnderstood: 'Il n’a pas compris.',
  listening: 'Je t’écoute…',
} as const;

export const OUT = {
  title: 'Sortir',
  walk: 'Promenade',
  walkHint: 'Trace un trajet en ville',
  shop: 'Boutique',
  shopHint: 'Nourriture, jouets, accessoires, soins',
  market: 'Brocante',
  marketHint: 'Change chaque jour, rachète tes objets',
  coins: 'pièces',
  close: 'Fermer',
  food: 'Nourriture',
  toys: 'Jouets',
  accessories: 'Accessoires',
  care: 'Soins',
  buy: 'Acheter',
  sell: 'Revendre',
  added: 'dans ton sac',
  sold: 'revendu',
  notEnough: 'Pas assez de pièces.',
  todayStock: 'Aujourd’hui à la brocante',
  resell: 'Ce que tu peux revendre',
  nothingToSell: 'Rien à revendre pour l’instant.',
  book: 'Carnet',
  objects: 'Objets',
  tricks: 'Tours',
  myItems: 'Mes objets',
  wear: 'Porter',
  worn: 'Porté',
  give: 'Donner',
  use: 'Utiliser',
} as const;

export const WALK = {
  mapTitle: 'Promenade',
  mapHint: 'Trace un trajet avec le doigt, en partant de la maison.',
  distance: 'Distance',
  go: 'Partir',
  clear: 'Effacer',
  noGains: 'Il s’est promené il y a peu : cette promenade ne rapportera pas de gains. Encore {min} min.',
  home: 'Rentrer',
  pickup: 'Ramasser',
  enter: 'Entrer',
  continue: 'Continuer',
  parkSoon: 'Le parc : bientôt, l’entraînement au disque.',
  gymSoon: 'Le gymnase : bientôt, l’entraînement à l’agilité.',
  endTitle: 'Promenade terminée',
  endEarly: 'Promenade écourtée',
  found: 'Trouvé en route',
  nothingFound: 'Rien trouvé cette fois.',
  gains: 'Gains',
  noRewardNow: 'Pas de gains cette fois : la prochaine promenade récompensée viendra un peu plus tard.',
  backHome: 'Rentrer à la maison',
  stamina: 'Endurance',
  leashHint: 'Tire la laisse vers le haut ou le bas',
} as const;

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
