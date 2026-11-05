/** Textes affichés, regroupés pour une future traduction. */

export type NeedKind = 'hunger' | 'thirst' | 'cleanliness' | 'fun';
export type NeedLevel = 'excellent' | 'normal' | 'watch' | 'urgent';

/** F-SOIN-4 : l'état en mots (SPEC, tableau des mots ; D-26 pour le niveau Normal). */
export const NEED_WORDS: Record<NeedKind, Record<NeedLevel, string>> = {
  hunger: { excellent: 'Repu', normal: 'Ça va', watch: 'A faim', urgent: 'Affamé' },
  thirst: { excellent: 'Désaltéré', normal: 'Ça va', watch: 'A soif', urgent: 'Assoiffé' },
  cleanliness: { excellent: 'Superbe', normal: 'Propre', watch: 'Sale', urgent: 'Très sale' },
  fun: { excellent: 'Ravi', normal: 'Ça va', watch: 'S’ennuie', urgent: 'S’ennuie beaucoup' },
};

export const NEED_LABELS: Record<NeedKind, string> = {
  hunger: 'Faim',
  thirst: 'Soif',
  cleanliness: 'Pelage',
  fun: 'Amusement',
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
export const TOY_HINT = 'Lance-le d’un geste ; pose-le dans le panier pour le ranger';

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
  obedience: 'Obéissance',
  mastery: 'Maîtrise',
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
  /** D-81 : vrais pas du joueur. */
  steps: '{n} pas',
  stepsBonus: 'Tes pas : {n} (+{p} ★)',
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

/** D-80 : atelier des tours avancés. */
export const WORKSHOP = {
  title: 'Atelier des tours',
  open: 'Atelier des tours',
  intro: 'Des tours plus difficiles, qui s’ouvrent quand {name} monte de niveau. Regarde la suite de mouvements, puis refais-la dans l’ordre.',
  locked: 'Niveau {n} du chiot',
  learned: 'Appris : on peut s’exercer',
  noRoom: 'Plus de place aujourd’hui',
  play: 'Apprendre',
  practice: 'S’exercer',
  round: 'Manche {n} / {max}',
  watch: 'Regarde…',
  yourTurn: 'À toi !',
  good: 'Bien !',
  won: 'Réussi ! Encore {n} fois pour qu’il apprenne le tour.',
  wonLearned: 'Bravo ! {name} connaît ce tour.',
  lost: 'Raté ! Ce n’était pas le bon mouvement.',
  again: 'Rejouer',
  back: 'Terminer',
  quit: 'Arrêter',
} as const;

/** D-78 : niveaux du joueur et des chiots. */
export const LEVELS = {
  you: 'Toi',
  level: 'Niveau',
  short: 'niv.',
  xp: 'XP',
  playerUp: 'Tu passes au niveau {n} (+{c} pièces).',
  dogUp: '{name} passe au niveau {n} !',
} as const;

/** D-88 : salle de bain. */
export const BATH = {
  title: 'Salle de bain',
  steps: { wet: 'Mouiller', soap: 'Savonner', rinse: 'Rincer', dry: 'Sécher' },
  /** Mot affiché et lu quand l'étape est finie. */
  doneWords: { wet: 'Mouillé !', soap: 'Savonné !', rinse: 'Rincé !', dry: 'Sec et tout propre !' },
  hints: {
    wet: 'Passe la douche sur tout le chiot.',
    soap: 'Frotte-le avec le savon, partout.',
    rinse: 'Rince toute la mousse avec la douche.',
    dry: 'Sèche-le au sèche-cheveux.',
    done: 'Tout propre ! Tu peux le ramener au salon.',
  },
  wrongTool: 'Pas encore : {step} d’abord.',
  dryer: 'Sèche-cheveux',
  back: 'Retour au salon',
} as const;

export const UI = {
  /** D-90 */
  basket: 'Panier',
  putAway: 'Ranger les jouets',
  poopPicked: 'Ramassé ! +5',
  poopForgotten: 'Ramassé, enfin…',
  putAwayDone: 'Jouets rangés.',
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
  done: 'Fini',
  dragHint: 'Glisse sur le sol',
  puppy: 'Ton chiot',
  asleep: 'Il dort',
} as const;

export const CONTEST_NAMES = { disc: 'Disque', agility: 'Agilité', obedience: 'Obéissance' } as const;
export const CLASS_NAMES = ['Débutant', 'Ouvert', 'Expert', 'Maître', 'Champion'] as const;

export const CONTEST = {
  title: 'Concours',
  hint: 'Trois concours par jour avec des prix',
  enter: 'S’inscrire',
  forFun: 'Pour le plaisir : plus de prix aujourd’hui.',
  prizesLeft: 'Prix encore possibles aujourd’hui : {n}',
  /** F-CON-7 : une phrase par raison de refus. */
  refusal(reason: 'hungry' | 'dirty' | 'notVisited' | 'noTricks', contest: 'disc' | 'agility' | 'obedience', name: string): string {
    switch (reason) {
      case 'hungry':
        return `${name} a trop faim pour concourir : donne-lui d’abord à manger.`;
      case 'dirty':
        return `${name} est trop sale pour se présenter : un bain d’abord !`;
      case 'notVisited':
        return contest === 'disc' ? `Passe d’abord par le parc en promenade pour découvrir le disque.` : `Passe d’abord par le gymnase en promenade pour découvrir l’agilité.`;
      case 'noTricks':
        return `${name} doit connaître au moins un tour pour l’obéissance.`;
    }
  },
  discHint: 'Lance le disque d’un geste vers le haut. Doux, il l’attrape en l’air.',
  agilityHint: 'Garde le doigt sur l’écran : ton chiot suit ton doigt d’obstacle en obstacle.',
  obedienceHint: 'Retrace le dessin de l’ordre affiché (bonus de précision), ou donne-le au bouton ou à la voix, le plus vite possible.',
  traceLabel: 'Retrace ici le dessin de l’ordre',
  traceAgain: 'Presque ! Retrace le dessin',
  start: 'Partez !',
  quit: 'Abandonner',
  time: 'Temps',
  score: 'Score',
  penalties: 'Pénalités',
  resultTitle: 'Résultats',
  place: ['1re place', '2e place', '3e place', '4e place', '5e place', '6e place'],
  classUp: '{name} passe en classe {cls} !',
  noPrize: 'Pour le plaisir : pas de gain cette fois.',
  consolation: 'Pas de podium, mais un peu d’expérience.',
  points: 'points de maître',
  coins: 'pièces',
  back: 'Rentrer',
  you: 'Toi',
  rivals: ['Pirouette', 'Gribouille', 'Zéphyr', 'Bonbon', 'Cannelle'],
  air: 'En l’air !',
  ground: 'Au sol',
  out: 'Dehors',
  wrongOrder: 'Raté',
} as const;

export const UNLOCKS = {
  title: 'Nouveau !',
  rope: 'La corde et le gros ballon sont arrivés.',
  breed: 'Une nouvelle race t’attend au chenil : {breed}.',
  sofa: 'Un petit canapé pour la sieste.',
  decor: 'Nouveau décor : {decor}.',
  toy: 'Un jouet mécanique dans ton sac.',
  secret: 'Une race secrète est apparue au chenil…',
} as const;

export const DECOR_NAMES = { home: 'Maison', seaside: 'Bord de mer', space: 'Espace' } as const;

export const FAMILY = {
  title: 'Pension',
  hint: 'Qui reste à la maison, et le décor',
  adoptHint: 'Adopter un chiot de plus',
  home: 'À la maison',
  hotel: 'À la pension',
  toHotel: 'En pension',
  toHome: 'À la maison',
  homeFull: 'Il y a déjà 3 chiots à la maison.',
  hotelFull: 'La pension est pleine (5 places).',
  lastHome: 'Garde au moins un chiot à la maison.',
  full: 'Tu as déjà 8 chiots : c’est le maximum.',
  toHotelToast: 'La maison est pleine : ton nouveau chiot t’attend à la pension.',
  decor: 'Décor',
} as const;

export const SETTINGS = {
  title: 'Réglages',
  hint: 'Sons, animations, sauvegarde',
  reduceMotion: 'Réduire les animations',
  brightness: 'Luminosité',
  music: 'Musique',
  sfx: 'Bruitages',
  voices: 'Effacer mes empreintes vocales',
  voicesDone: 'Empreintes vocales effacées.',
  saveTitle: 'Sauvegarde',
  saveHint: 'Garde une copie de ta partie dans un fichier, ou reprends-la sur un autre appareil.',
  export: 'Exporter',
  import: 'Importer',
  importSure: 'La partie actuelle sera remplacée par celle du fichier. Continuer ?',
  importBad: 'Ce fichier n’est pas une sauvegarde de Truffe.',
  privacy: 'Aucun son ne quitte ton appareil : seules des empreintes de ta voix sont gardées, et le fichier exporté les contient.',
} as const;
