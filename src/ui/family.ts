/**
 * Pension (F-VIE-4) : 3 chiots à la maison, 5 à la pension ; et le décor du salon.
 * L'interface appelle les fonctions fournies ; elle ne touche jamais à l'état.
 */
import { DECOR_NAMES, FAMILY } from '../data/strings';
import type { DecorId, DogId } from '../sim/state';
import { panel } from './outings';

export interface FamilyHandlers {
  dogs(): { id: DogId; name: string; breed: string; home: boolean }[];
  /** Renvoie un message d'erreur, ou null. */
  move(id: DogId, to: 'home' | 'hotel'): string | null;
  decors(): { id: DecorId; unlocked: boolean; current: boolean }[];
  setDecor(id: DecorId): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

export function openFamily(h: FamilyHandlers, onClose: () => void): void {
  const p = panel(FAMILY.title, null, onClose);
  const msg = el('p', 'hint');
  msg.setAttribute('role', 'status');
  const render = (): void => {
    p.body.innerHTML = '';
    const dogs = h.dogs();
    for (const [title, home] of [
      [FAMILY.home, true],
      [FAMILY.hotel, false],
    ] as const) {
      const list = dogs.filter((d) => d.home === home);
      p.body.append(el('h3', 'subtitle', `${title} · ${list.length}`));
      const ul = el('ul', 'family-list');
      for (const d of list) {
        const li = el('li', 'family-dog', `<strong>${d.name}</strong><small>${d.breed}</small>`);
        li.dataset.dog = d.id;
        const b = el('button', 'btn mini', `<span>${home ? FAMILY.toHotel : FAMILY.toHome}</span>`);
        b.type = 'button';
        b.dataset.testid = `move-${d.id}`;
        b.addEventListener('click', () => {
          const err = h.move(d.id, home ? 'hotel' : 'home');
          render();
          msg.textContent = err ?? '';
        });
        li.append(b);
        ul.append(li);
      }
      p.body.append(ul);
    }
    p.body.append(msg);
    p.body.append(el('h3', 'subtitle', FAMILY.decor));
    const decors = el('div', 'tabs');
    for (const d of h.decors()) {
      const b = el('button', 'tab', DECOR_NAMES[d.id]);
      b.type = 'button';
      b.dataset.testid = `decor-${d.id}`;
      b.disabled = !d.unlocked;
      b.setAttribute('aria-pressed', String(d.current));
      b.addEventListener('click', () => {
        h.setDecor(d.id);
        render();
      });
      decors.append(b);
    }
    p.body.append(decors);
  };
  render();
}
