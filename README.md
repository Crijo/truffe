# Truffe

Un jeu web de chiot virtuel : adopter un chiot, le caresser, le nourrir, le dresser à la voix ou aux boutons, le promener en ville.

**Jouer :** https://crijo.github.io/truffe/ (téléphone en portrait de préférence).

Le jeu tourne entièrement dans le navigateur : pas de compte, pas de serveur, sauvegarde locale. La voix est reconnue sur l'appareil ; aucun son n'est envoyé.

## Développement

```bash
npm install
npm run dev        # serveur local, accessible sur le réseau
npm run dev:https  # idem en HTTPS, pour le micro sur téléphone
npm run check      # lint, types, tests unitaires
npm run e2e        # parcours Playwright
```

La spécification est dans `SPEC.md`, les choix de conception dans `DECISIONS.md`, l'origine des ressources dans `ASSETS.md`, les consignes de développement dans `CLAUDE.md`.

Les enregistrements vocaux de test ne sont pas publiés : `scripts/make-voice-fixtures.ps1` les régénère sous Windows ; sans eux, les tests vocaux sont sautés.
