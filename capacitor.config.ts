import type { CapacitorConfig } from '@capacitor/cli';

/**
 * D-100 : Truffe en appli Android. Le jeu est embarqué dans l'appli (jouable hors ligne
 * dès l'installation) ; les mises à jour du jeu arrivent à distance (D-101).
 */
const config: CapacitorConfig = {
  appId: 'fr.crijo.truffe',
  appName: 'Truffe',
  webDir: 'dist-app',
  android: {
    // Fond du jeu pendant le chargement.
    backgroundColor: '#f6e7d0',
  },
  plugins: {
    CapacitorUpdater: {
      // D-101 : c'est le jeu qui vérifie et télécharge ses mises à jour (pas de service en ligne tiers).
      autoUpdate: false,
      // Une mise à jour qui ne démarre pas dans les 10 s est annulée : l'appli revient à la version d'avant.
      appReadyTimeout: 10000,
      resetWhenUpdate: true,
    },
  },
};

export default config;
