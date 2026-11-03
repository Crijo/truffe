/**
 * Voix dans le jeu : permission expliquée d'abord, ordres en maintenant le bouton Micro,
 * enregistrement des ordres et du nom depuis la fiche.
 */
import type { GameStore } from '../core/store';
import { BALANCE } from '../data/balance';
import { VOICE } from '../data/strings';
import { TRICKS, type TrickId } from '../data/tricks';
import { VoiceCapture } from '../input/voice/capture';
import { closestOther, recognize, type VoiceCommand } from '../input/voice/matcher';
import { features } from '../input/voice/mfcc';
import type { DogId } from '../sim/state';
import { ICONS } from './icons';

const NAME_ID = 'name';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

export class VoiceController {
  private readonly capture = new VoiceCapture();
  private listening = false;
  /** Concours d'obéissance : l'ordre reconnu va à l'épreuve plutôt qu'au salon. */
  orderHook: ((trickId: TrickId) => void) | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly dogId: () => DogId,
    private readonly toast: (text: string) => void,
    private readonly save: () => void,
  ) {}

  /** La voix est possible ici (et le joueur ne l'a pas refusée). */
  supported(): boolean {
    return VoiceCapture.supported() && this.store.getState().save.settings.micAllowed !== false;
  }

  private dog() {
    return this.store.getState().save.dogs.find((d) => d.id === this.dogId());
  }

  /** Ordres connus avec leurs empreintes, et le nom du chiot. */
  private commands(): (VoiceCommand & { label: string })[] {
    const d = this.dog();
    if (!d) return [];
    const out: (VoiceCommand & { label: string })[] = d.tricks
      .filter((t) => t.learned && (t.command.voice?.length ?? 0) > 0)
      .map((t) => ({ id: t.trickId, label: t.command.label, templates: t.command.voice ?? [] }));
    if (d.voiceName?.length) out.push({ id: NAME_ID, label: d.name, templates: d.voiceName });
    return out;
  }

  /** SPEC : le micro n'est demandé qu'au premier dressage vocal, avec une explication. */
  private async permission(): Promise<boolean> {
    const allowed = this.store.getState().save.settings.micAllowed;
    if (allowed === false) {
      this.toast(VOICE.denied);
      return false;
    }
    if (allowed === null && !(await this.ask())) return false;
    const ok = await this.capture.open();
    this.store.dispatch({ type: 'settings/mic', allowed: ok });
    this.save();
    if (!ok) this.toast(VOICE.denied);
    return ok;
  }

  private ask(): Promise<boolean> {
    return new Promise((resolve) => {
      const box = el('section', 'name-box', `<h2 class="title">${ICONS.mic} ${VOICE.askTitle}</h2><p class="hint">${VOICE.askText}</p>`);
      box.setAttribute('role', 'dialog');
      box.dataset.testid = 'mic-ask';
      const row = el('div', 'row-buttons');
      const later = el('button', 'btn', `<span>${VOICE.later}</span>`);
      const yes = el('button', 'btn primary', `${ICONS.mic}<span>${VOICE.allow}</span>`);
      later.addEventListener('click', () => {
        box.remove();
        resolve(false);
      });
      yes.addEventListener('click', () => {
        box.remove();
        resolve(true);
      });
      row.append(later, yes);
      box.append(row);
      document.body.append(box);
    });
  }

  // ------------------------------------------------------------ ordre à la voix

  async holdStart(): Promise<void> {
    if (!(await this.permission())) return;
    this.listening = true;
    this.toast(VOICE.listening);
    this.capture.start(() => this.holdEnd());
  }

  holdEnd(): void {
    if (!this.listening) return;
    this.listening = false;
    const rec = this.capture.stop();
    if (!rec) return;
    const f = features(rec.samples, rec.sampleRate);
    const commands = this.commands();
    const r = f ? recognize(f, commands) : null;
    if (!f || !r) {
      this.store.dispatch({ type: 'voice/miss' });
      return;
    }
    if (r.id === NAME_ID) this.store.dispatch({ type: 'call' });
    else if (this.orderHook) this.orderHook(r.id as TrickId);
    else this.store.dispatch({ type: 'order', trickId: r.id as TrickId });
    // SPEC : le jeu ajoute les exemples bien reconnus.
    if (r.distance < BALANCE.voice.acceptBelow * 0.6) {
      if (r.id === NAME_ID) this.store.dispatch({ type: 'name/voice', template: f });
      else this.store.dispatch({ type: 'trick/voice', trickId: r.id as TrickId, template: f });
    }
  }

  // ------------------------------------------------------------ enregistrement (fiche)

  async record(target: TrickId | 'name', onDone: () => void): Promise<void> {
    if (!(await this.permission())) return;
    const d = this.dog();
    const label = target === NAME_ID ? (d?.name ?? '') : (d?.tricks.find((t) => t.trickId === target)?.command.label ?? TRICKS[target].label);
    const title = target === NAME_ID ? VOICE.recordNameTitle : VOICE.recordTitle;
    const box = el('section', 'name-box voice-box', `<h2 class="title">${title} « ${label} »</h2>`);
    box.setAttribute('role', 'dialog');
    box.dataset.testid = 'voice-record';
    const rec = el('button', 'rec', `${ICONS.mic}<span>${VOICE.hold}</span>`);
    rec.type = 'button';
    const status = el('p', 'hint');
    status.setAttribute('role', 'status');
    const done = el('button', 'btn primary', `${ICONS.done}<span>${VOICE.done}</span>`);
    const count = (): number => (target === NAME_ID ? (this.dog()?.voiceName?.length ?? 0) : (this.dog()?.tricks.find((t) => t.trickId === target)?.command.voice?.length ?? 0));
    const progress = (): string => `${count()} / ${target === NAME_ID ? 3 : 5}`;
    status.textContent = progress();
    rec.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      rec.setPointerCapture(e.pointerId);
      rec.setAttribute('aria-pressed', 'true');
      this.capture.start(() => rec.dispatchEvent(new PointerEvent('pointerup')));
    });
    rec.addEventListener('pointerup', () => {
      rec.setAttribute('aria-pressed', 'false');
      const r = this.capture.stop();
      if (!r) return;
      const f = features(r.samples, r.sampleRate);
      if (!f) {
        status.textContent = VOICE.tooShort;
        return;
      }
      const near = closestOther(f, this.commands(), target);
      if (near && near.distance < BALANCE.voice.similarBelow) {
        // F-DRE-3 : point d'interrogation bleu, et proposition de réessayer.
        this.store.dispatch({ type: 'voice/similar' });
        const other = this.commands().find((c) => c.id === near.id)?.label ?? '';
        status.textContent = VOICE.tooClose.replace('{other}', other);
        return;
      }
      if (target === NAME_ID) this.store.dispatch({ type: 'name/voice', template: f });
      else this.store.dispatch({ type: 'trick/voice', trickId: target, template: f });
      this.save();
      status.textContent = `${VOICE.saved} · ${progress()}`;
    });
    done.addEventListener('click', () => {
      box.remove();
      onDone();
    });
    const row = el('div', 'row-buttons');
    row.append(done);
    box.append(rec, status, row);
    document.body.append(box);
  }

  clearAll(): void {
    this.store.dispatch({ type: 'voice/clearAll' });
    this.save();
  }

  nameVoices(): number {
    return this.dog()?.voiceName?.length ?? 0;
  }
}
