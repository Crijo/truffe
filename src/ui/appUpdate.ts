/**
 * D-101, D-102 : mises à jour de l'appli Android à distance. À l'ouverture (et sur demande dans
 * les Réglages), le jeu lit app/latest.json sur GitHub Pages. S'il y a du nouveau, une fenêtre
 * l'annonce avec la liste des nouveautés :
 *  - nouvelle version du jeu : « Mettre à jour » la télécharge et relance le jeu ; « Plus tard »
 *    la télécharge en arrière-plan, elle s'appliquera à la prochaine ouverture ;
 *  - le jeu demande une appli plus récente : la fenêtre propose de télécharger le nouvel APK.
 * Chargé seulement dans l'appli (jamais dans le navigateur, qui a son service worker).
 */
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import { APP_UPDATE } from '../data/strings';
import { parseManifest, updateDecision, type UpdateManifest } from '../core/updatePolicy';
import { showUpdatePopup } from './updatePopup';

export const MANIFEST_URL = 'https://crijo.github.io/truffe/app/latest.json';

/** Le jeu a bien démarré : la nouvelle version est gardée (sinon l'appli revient à la précédente). */
export async function appReady(): Promise<void> {
  await CapacitorUpdater.notifyAppReady();
}

const download = (m: UpdateManifest): Promise<BundleInfo> => CapacitorUpdater.download({ url: m.bundle, version: m.version });

/** Vérifie s'il y a une mise à jour ; `say` affiche un message court (vérification demandée par le joueur). */
export async function checkForUpdates(say?: (text: string) => void): Promise<void> {
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
    const manifest = parseManifest(await res.json());
    if (!manifest) throw new Error('version illisible');
    const cur = await CapacitorUpdater.current();
    const list = await CapacitorUpdater.list();
    const ready = list.bundles.find((b) => b.version === manifest.version && b.status === 'success');
    const decision = updateDecision(manifest, { version: __TRUFFE_VERSION__, native: Number.parseInt(cur.native, 10) || 1, pending: ready ? ready.version : null });
    const apk = (url: string, heading: string): void => {
      showUpdatePopup({ heading, hint: APP_UPDATE.apkHint, notes: manifest.notes, action: APP_UPDATE.download, onAction: () => (window.location.href = url) });
    };
    if (decision.kind === 'native') return apk(decision.url, APP_UPDATE.needApk);
    if (decision.kind === 'none') {
      if (decision.newerApk) apk(decision.newerApk, APP_UPDATE.newerApk);
      else say?.(APP_UPDATE.upToDate);
      return;
    }
    say?.('');
    showUpdatePopup({
      heading: APP_UPDATE.available,
      hint: APP_UPDATE.laterHint,
      notes: manifest.notes,
      action: APP_UPDATE.restart,
      onAction: (popup) => {
        popup.status(APP_UPDATE.downloading, true);
        void (async () => {
          try {
            const bundle = decision.kind === 'ready' && ready ? ready : await download(manifest);
            popup.status(APP_UPDATE.installing, true);
            // Le jeu se relance aussitôt sur la nouvelle version.
            await CapacitorUpdater.set({ id: bundle.id });
          } catch {
            popup.status(APP_UPDATE.failed);
          }
        })();
      },
      // Plus tard : téléchargée en arrière-plan, appliquée à la prochaine ouverture.
      onLater: () => {
        void (async () => {
          const bundle = decision.kind === 'ready' && ready ? ready : await download(manifest);
          await CapacitorUpdater.next({ id: bundle.id });
        })().catch(() => undefined);
      },
    });
  } catch {
    say?.(APP_UPDATE.offline);
  }
}
