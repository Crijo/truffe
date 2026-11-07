/**
 * Réglages (jalon 7) : animations, sons, musique, empreintes vocales, export et import.
 * L'interface appelle les fonctions fournies ; elle ne touche jamais à l'état.
 */
import { SETTINGS, APP_UPDATE } from '../data/strings';
import { panel } from './outings';

export interface SettingsHandlers {
  get(): { reduceMotion: boolean; musicVolume: number; sfxVolume: number; brightness: number };
  set(patch: { reduceMotion?: boolean; musicVolume?: number; sfxVolume?: number; brightness?: number }): void;
  clearVoices(): void;
  exportSave(): void;
  /** Renvoie un message d'erreur, ou null (la page se recharge). */
  importSave(text: string): Promise<string | null>;
  /** D-101 : version du jeu ; dans l'appli, vérifier les mises à jour (renvoie le message à afficher). */
  version(): string;
  checkUpdates?: (() => Promise<string>) | undefined;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

function slider(label: string, value: number, testid: string, onInput: (v: number) => void): HTMLElement {
  const row = el('label', 'setting');
  const input = el('input', '');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.value = String(Math.round(value * 100));
  input.dataset.testid = testid;
  input.addEventListener('input', () => onInput(Number(input.value) / 100));
  row.append(el('span', '', label), input);
  return row;
}

export function openSettings(h: SettingsHandlers, onClose: () => void): void {
  const p = panel(SETTINGS.title, null, onClose);
  const s = h.get();
  const motion = el('label', 'setting');
  const box = el('input', '');
  box.type = 'checkbox';
  box.checked = s.reduceMotion;
  box.dataset.testid = 'reduce-motion';
  box.addEventListener('change', () => h.set({ reduceMotion: box.checked }));
  motion.append(el('span', '', SETTINGS.reduceMotion), box);
  const msg = el('p', 'hint');
  msg.setAttribute('role', 'status');
  const voices = el('button', 'btn mini', `<span>${SETTINGS.voices}</span>`);
  voices.type = 'button';
  voices.dataset.testid = 'clear-voices';
  voices.addEventListener('click', () => {
    h.clearVoices();
    msg.textContent = SETTINGS.voicesDone;
  });
  const exp = el('button', 'btn', `<span>${SETTINGS.export}</span>`);
  exp.type = 'button';
  exp.dataset.testid = 'export-save';
  exp.addEventListener('click', () => h.exportSave());
  const file = el('input', '');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.hidden = true;
  file.dataset.testid = 'import-file';
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (!f) return;
    void f.text().then(async (text) => {
      if (!window.confirm(SETTINGS.importSure)) return;
      const err = await h.importSave(text);
      if (err) msg.textContent = err;
    });
    file.value = '';
  });
  const imp = el('button', 'btn', `<span>${SETTINGS.import}</span>`);
  imp.type = 'button';
  imp.dataset.testid = 'import-save';
  imp.addEventListener('click', () => file.click());
  const row = el('div', 'setting-row');
  row.append(exp, imp, file);
  p.body.append(
    slider(SETTINGS.brightness, s.brightness, 'brightness', (v) => h.set({ brightness: v })),
    motion,
    slider(SETTINGS.music, s.musicVolume, 'music-volume', (v) => h.set({ musicVolume: v })),
    slider(SETTINGS.sfx, s.sfxVolume, 'sfx-volume', (v) => h.set({ sfxVolume: v })),
    voices,
    el('p', 'hint', SETTINGS.privacy),
    el('h3', 'subtitle', SETTINGS.saveTitle),
    el('p', 'hint', SETTINGS.saveHint),
    row,
    msg,
  );
  // D-101 : version, et dans l'appli Android, vérification des mises à jour.
  const ver = el('p', 'hint', APP_UPDATE.version.replace('{v}', h.version()));
  ver.dataset.testid = 'game-version';
  p.body.append(ver);
  const check = h.checkUpdates;
  if (check) {
    const b = el('button', 'btn mini', `<span>${APP_UPDATE.check}</span>`);
    b.type = 'button';
    b.dataset.testid = 'check-updates';
    b.addEventListener('click', () => {
      msg.textContent = APP_UPDATE.checking;
      void check().then((t) => (msg.textContent = t));
    });
    p.body.append(b);
  }
}
