/**
 * D-101 : mises à jour de l'appli Android à distance. À l'ouverture (et sur demande dans les
 * Réglages), le jeu lit app/latest.json sur GitHub Pages :
 *  - nouvelle version du jeu : le paquet est téléchargé en arrière-plan, puis appliqué à la
 *    prochaine ouverture (ou tout de suite, d'un toucher) ;
 *  - le jeu demande une appli plus récente : un message propose de télécharger le nouvel APK.
 * Chargé seulement dans l'appli (jamais dans le navigateur, qui a son service worker).
 */
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { APP_UPDATE } from '../data/strings';
import { parseManifest, updateDecision } from '../core/updatePolicy';

export const MANIFEST_URL = 'https://crijo.github.io/truffe/app/latest.json';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

/** Bandeau en bas de l'écran, avec un bouton. */
function banner(text: string, action: string, onAction: () => void): void {
  document.querySelector('.app-update')?.remove();
  const b = el('div', 'app-update');
  b.setAttribute('role', 'status');
  b.dataset.testid = 'app-update';
  const p = el('p', '', text);
  const go = el('button', 'btn primary', `<span>${action}</span>`);
  go.type = 'button';
  go.addEventListener('click', onAction);
  const later = el('button', 'btn', `<span>${APP_UPDATE.later}</span>`);
  later.type = 'button';
  later.addEventListener('click', () => b.remove());
  const row = el('div', 'row-buttons');
  row.append(later, go);
  b.append(p, row);
  document.body.append(b);
}

/** Le jeu a bien démarré : la nouvelle version est gardée (sinon l'appli revient à la précédente). */
export async function appReady(): Promise<void> {
  await CapacitorUpdater.notifyAppReady();
}

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
    if (decision.kind === 'native') {
      banner(APP_UPDATE.needApk, APP_UPDATE.download, () => (window.location.href = decision.url));
      return;
    }
    if (decision.kind === 'none') {
      if (decision.newerApk) {
        const url = decision.newerApk;
        banner(APP_UPDATE.newerApk, APP_UPDATE.download, () => (window.location.href = url));
      } else say?.(APP_UPDATE.upToDate);
      return;
    }
    const bundle = decision.kind === 'ready' && ready ? ready : await CapacitorUpdater.download({ url: decision.kind === 'bundle' ? decision.url : manifest.bundle, version: manifest.version });
    // Appliquée à la prochaine ouverture ; ou tout de suite, si le joueur le veut.
    await CapacitorUpdater.next({ id: bundle.id });
    banner(APP_UPDATE.ready, APP_UPDATE.restart, () => void CapacitorUpdater.set({ id: bundle.id }));
  } catch {
    say?.(APP_UPDATE.offline);
  }
}
