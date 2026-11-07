/**
 * D-102 : fenêtre qui annonce une mise à jour de l'appli et ce qu'elle contient.
 * Sans Capacitor : on peut l'afficher dans le navigateur pour la vérifier (?debug&updatePopup).
 */
import { APP_UPDATE } from '../data/strings';
import type { UpdateNotes } from '../core/updatePolicy';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

export interface PopupOptions {
  /** Titre de la fenêtre et phrase sous la liste. */
  heading: string;
  hint: string;
  notes: UpdateNotes | undefined;
  /** Bouton principal (mettre à jour, télécharger l'appli). */
  action: string;
  onAction: (popup: UpdatePopup) => void;
  onLater?: (() => void) | undefined;
}

export interface UpdatePopup {
  /** Message d'état (téléchargement en cours, erreur) ; bloque les boutons si `busy`. */
  status(text: string, busy?: boolean): void;
  close(): void;
}

export function showUpdatePopup(o: PopupOptions): UpdatePopup {
  document.querySelector('.update-popup')?.remove();
  const veil = el('div', 'update-popup');
  veil.dataset.testid = 'update-popup';
  const box = el('section', 'update-box');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'update-title');
  const title = el('h2', 'title', o.heading);
  title.id = 'update-title';
  box.append(title);
  if (o.notes) {
    box.append(el('h3', 'subtitle', o.notes.title));
    const list = el('ul', 'update-notes');
    list.dataset.testid = 'update-notes';
    for (const item of o.notes.items) {
      const li = el('li', '');
      li.textContent = item;
      list.append(li);
    }
    box.append(list);
  }
  const hint = el('p', 'hint', o.hint);
  const status = el('p', 'update-status');
  status.setAttribute('role', 'status');
  const later = el('button', 'btn', `<span>${APP_UPDATE.later}</span>`);
  later.type = 'button';
  later.dataset.testid = 'update-later';
  const go = el('button', 'btn primary', `<span>${o.action}</span>`);
  go.type = 'button';
  go.dataset.testid = 'update-now';
  const row = el('div', 'row-buttons');
  row.append(later, go);
  box.append(hint, status, row);
  veil.append(box);
  document.body.append(veil);
  go.focus();

  const popup: UpdatePopup = {
    status(text, busy = false) {
      status.textContent = text;
      go.disabled = busy;
      later.disabled = busy;
    },
    close: () => veil.remove(),
  };
  later.addEventListener('click', () => {
    popup.close();
    o.onLater?.();
  });
  go.addEventListener('click', () => o.onAction(popup));
  return popup;
}
