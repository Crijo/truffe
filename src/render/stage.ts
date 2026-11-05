import { Application, Container, Graphics } from 'pixi.js';
import type { DecorId } from '../sim/state';
import { nightAlpha } from '../sim/needs';
import { SEASONS, type Season } from '../data/seasons';
import { BALANCE } from '../data/balance';
import { PuppyView } from './puppy/PuppyView';
import { Room } from './room';
import { SeasonFx } from './seasonFx';

/** Palettes du salon : aplats doux de livre illustré ; deux décors à débloquer (D-63). */
const PALETTES = {
  home: { wall: 0xf6e7d0, wallShade: 0xefdcc1, baseboard: 0xfbf5ec, floor: 0xe2b98b, floorLine: 0xd6a978, rug: 0xc7d6c0, rugEdge: 0xb5c8ad },
  seaside: { wall: 0xbfe3f0, wallShade: 0x9fd0e6, baseboard: 0xf5ecd6, floor: 0xeed9a8, floorLine: 0xe2c98f, rug: 0xf2a49a, rugEdge: 0xe08b80 },
  space: { wall: 0x262a4f, wallShade: 0x1d2142, baseboard: 0x5a5f96, floor: 0x8e88b8, floorLine: 0x7d77a8, rug: 0x6fb7c9, rugEdge: 0x5aa0b2 },
} as const;
const ROOM = PALETTES.home;
const SOFA = { body: 0x5f8fb0, dark: 0x4a7392, cushion: 0xf2e2c4 } as const;

export interface Stage {
  app: Application;
  room: Room;
  /** Calque du chiot et des objets au sol, trié par profondeur. */
  world: Container;
  /** Teinte selon l'heure locale (décor qui change discrètement). */
  setHour(hour: number, brightness: number): void;
  /** Décor du salon et canapé (déblocages). */
  setDecor(decor: DecorId, sofa: boolean): void;
  /** D-77 : saison vue par la fenêtre. */
  setSeason(season: Season): void;
  /** D-83 : décalage de la caméra (pixels) ; le décor et le sol suivent. */
  setCamera(x: number): void;
}

/** Part de nuit : 1 de 22 h à 6 h, transitions le soir et au matin. */
export function nightFactor(h: number): number {
  if (h >= 22 || h < 6) return 1;
  if (h >= 19) return (h - 19) / 3;
  if (h < 8) return 1 - (h - 6) / 2;
  return 0;
}

export async function createStage(host: HTMLElement): Promise<Stage> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: ROOM.wall,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  app.canvas.setAttribute('aria-label', 'Salon');
  host.appendChild(app.canvas);

  const room = new Room();
  const decor = new Graphics();
  const world = new Container();
  world.sortableChildren = true;
  const night = new Graphics();
  night.eventMode = 'none';
  const falling = new SeasonFx(14);
  const pane = new Graphics();
  falling.g.mask = pane;
  // Cadre et croisillons au-dessus de ce qui tombe : les feuilles restent derrière la vitre.
  const frame = new Graphics();
  const backdrop = new Container();
  backdrop.addChild(decor, pane, falling.g, frame);
  app.stage.addChild(backdrop, world, night);

  let decorId: DecorId = 'home';
  let season: Season = 'summer';
  let windowRect = { x: 0, y: 0, w: 0, h: 0 };
  let sofa = false;
  /** Mobilier hors de la vue de départ : panier et plante à gauche, porte et bibliothèque à droite (créés pour Truffe). */
  const sides = (w: number, h: number, y: number, P: (typeof PALETTES)[DecorId]): void => {
    const g = decor;
    // Largeur (px) dont la vue peut glisser de chaque côté (même calcul que le salon, D-89).
    const span = BALANCE.puppy.roam.maxView * Math.max(1, room.floorToScreen({ x: 1, z: 0.6 }).x - room.floorToScreen({ x: 0, z: 0.6 }).x);
    const s0 = room.floorToScreen({ x: 0, z: 0.22 }).s;
    const at = (x: number, z: number) => ({ x, y: room.floorToScreen({ x: 0, z }).y, s: s0 });
    // Gauche : cadre au mur, plante, panier du chien.
    const pic = at(-span * 0.22, 0);
    g.roundRect(pic.x - 46, y * 0.38, 92, 70, 6).fill(0xfbf5ec).stroke({ width: 6, color: 0xb98a5c });
    g.moveTo(pic.x - 34, y * 0.38 + 58).lineTo(pic.x - 10, y * 0.38 + 30).lineTo(pic.x + 6, y * 0.38 + 46).lineTo(pic.x + 18, y * 0.38 + 36).lineTo(pic.x + 34, y * 0.38 + 58).closePath().fill(0x9cc58f);
    g.circle(pic.x + 22, y * 0.38 + 18, 7).fill(0xf2c94c);
    const plant = at(-span * 0.85 + 10, 0.08);
    g.roundRect(plant.x - 20, plant.y - 40, 40, 40, 6).fill(0xc96f4a);
    for (let i = -2; i <= 2; i++) g.ellipse(plant.x + i * 9, plant.y - 64 - Math.abs(i) * -6, 9, 26).fill(i % 2 ? 0x5f9e5a : 0x74b06c);
    const bed = at(-span * 0.5, 0.22);
    g.ellipse(bed.x, bed.y, bed.s * 0.62, bed.s * 0.2).fill(0x8f5f86);
    g.ellipse(bed.x, bed.y - bed.s * 0.03, bed.s * 0.5, bed.s * 0.13).fill(0xd9b8d2);
    // Droite : porte, bibliothèque.
    const door = at(w + span * 0.2, 0);
    const dh = Math.min(y * 0.78, h * 0.42);
    g.roundRect(door.x - 44, y - dh, 88, dh, 8).fill(0xc9925e).stroke({ width: 6, color: P.baseboard });
    g.roundRect(door.x - 32, y - dh + 14, 64, dh * 0.38, 4).stroke({ width: 3, color: 0xb07a48 });
    g.roundRect(door.x - 32, y - dh * 0.52, 64, dh * 0.42, 4).stroke({ width: 3, color: 0xb07a48 });
    g.circle(door.x + 28, y - dh * 0.48, 5).fill(0xf2c94c);
    const shelf = at(w + span * 0.72, 0);
    const sw = 120;
    const sh = Math.min(y * 0.62, 220);
    g.rect(shelf.x - sw / 2, y - sh, sw, sh).fill(0xa8764a);
    const colors = [0xd9534f, 0x5b8fd9, 0xf2c94c, 0x6fb38a, 0xb07ad9, 0xe8955a];
    for (let row = 0; row < 3; row++) {
      const ry = y - sh + 10 + row * (sh / 3);
      g.rect(shelf.x - sw / 2 + 6, ry + sh / 3 - 16, sw - 12, 6).fill(0x8a5c36);
      for (let b = 0; b < 6; b++) g.rect(shelf.x - sw / 2 + 10 + b * 17, ry + 8 + ((b + row) % 3) * 4, 13, sh / 3 - 28 - ((b + row) % 3) * 4).fill(colors[(b + row * 2) % colors.length] ?? 0xd9534f);
    }
  };
  const drawRoom = (): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    room.layout(w, h);
    const y = room.horizon;
    const ROOM = PALETTES[decorId];
    decor.clear();
    frame.clear();
    const x0 = -3 * w;
    const ww = 7 * w;
    decor.rect(x0, 0, ww, y).fill(ROOM.wall);
    decor.rect(x0, y - h * 0.18, ww, h * 0.18).fill(ROOM.wallShade);
    decor.rect(x0, y, ww, h - y).fill(ROOM.floor);
    for (let i = 1; i < 5; i++) {
      const ly = y + (h - y) * (i / 5) ** 1.4;
      decor.rect(x0, ly, ww, 2).fill(ROOM.floorLine);
    }
    decor.rect(x0, y - 6, ww, 12).fill(ROOM.baseboard);
    // D-89 : le salon continue de chaque côté ; un peu de mobilier quand on fait glisser la vue.
    sides(w, h, y, ROOM);
    const rug = room.floorToScreen({ x: 0, z: 0.62 });
    decor.ellipse(w / 2, rug.y, Math.min(w * 0.44, 420), (h - y) * 0.3).fill(ROOM.rug).stroke({ width: 4, color: ROOM.rugEdge });
    windowRect = { x: 0, y: 0, w: 0, h: 0 };
    pane.clear();
    if (decorId === 'home') {
      // D-77 : fenêtre sur le jardin, aux couleurs de la saison.
      const look = SEASONS[season];
      const fw = Math.min(w * 0.3, 220);
      const fh = Math.min(y * 0.42, fw * 1.05);
      const fx = w * 0.08;
      const fy = Math.max(y * 0.3, y - fh - h * 0.22);
      decor.roundRect(fx - 6, fy - 6, fw + 12, fh + 12, 10).fill(ROOM.baseboard);
      frame.roundRect(fx - 6, fy - 6, fw + 12, fh + 12, 10).stroke({ width: 7, color: ROOM.baseboard, alignment: 1 });
      decor.rect(fx, fy, fw, fh).fill(look.sky);
      decor.rect(fx, fy + fh * 0.72, fw, fh * 0.28).fill(look.snow ? 0xf4f7f9 : look.grass);
      const tx = fx + fw * 0.35;
      const ty = fy + fh * 0.72;
      decor.rect(tx - 4, ty - fh * 0.3, 8, fh * 0.3).fill(look.trunk);
      if (look.foliage.length === 0) {
        decor.moveTo(tx, ty - fh * 0.25).lineTo(tx - 18, ty - fh * 0.5).moveTo(tx, ty - fh * 0.2).lineTo(tx + 20, ty - fh * 0.48).moveTo(tx, ty - fh * 0.28).lineTo(tx, ty - fh * 0.56).stroke({ width: 3, color: look.trunk, cap: 'round' });
      } else {
        decor.circle(tx, ty - fh * 0.42, fh * 0.2).fill(look.foliage[0] ?? 0x7cc47f);
        decor.circle(tx + fh * 0.14, ty - fh * 0.34, fh * 0.13).fill(look.foliage[1] ?? look.foliage[0] ?? 0x7cc47f);
        if (look.dots !== null) for (let j = 0; j < 6; j++) decor.circle(tx + Math.cos(j * 2.4) * fh * 0.12, ty - fh * 0.42 + Math.sin(j * 2.4) * fh * 0.1, 2.5).fill(look.dots);
      }
      if (look.falling === 'leaves') for (let j = 0; j < 5; j++) decor.ellipse(fx + fw * (0.15 + j * 0.17), ty + fh * 0.08, 4, 2).fill(look.fallingColors[j % 3] ?? 0xe08a3c);
      // Croisillons de la fenêtre.
      frame.rect(fx + fw / 2 - 3, fy, 6, fh).fill(ROOM.baseboard);
      frame.rect(fx, fy + fh / 2 - 3, fw, 6).fill(ROOM.baseboard);
      windowRect = { x: fx, y: fy, w: fw, h: fh };
      pane.rect(fx, fy, fw, fh).fill(0xffffff);
    }
    if (decorId === 'seaside') {
      // Fenêtre sur la mer, vagues et soleil.
      const fx = w * 0.62;
      const fw = Math.min(w * 0.3, 260);
      const fy = y * 0.25;
      const fh = y * 0.45;
      decor.roundRect(fx, fy, fw, fh, 10).fill(0x7cc4e6).stroke({ width: 8, color: ROOM.baseboard });
      decor.circle(fx + fw * 0.75, fy + fh * 0.3, fh * 0.12).fill(0xffd166);
      decor.rect(fx + 4, fy + fh * 0.62, fw - 8, fh * 0.38 - 4).fill(0x3f86c6);
      for (let i = 0; i < 4; i++) decor.moveTo(fx + 10 + i * fw * 0.24, fy + fh * 0.7).quadraticCurveTo(fx + 20 + i * fw * 0.24, fy + fh * 0.64, fx + 30 + i * fw * 0.24, fy + fh * 0.7).stroke({ width: 3, color: 0xffffff });
    } else if (decorId === 'space') {
      // Hublot, étoiles et planète.
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 97) % 100) / 100;
        const sy = ((i * 53) % 100) / 100;
        decor.circle(sx * w, sy * (y - 12), 1 + (i % 3)).fill({ color: 0xffffff, alpha: 0.5 + (i % 4) * 0.12 });
      }
      decor.circle(w * 0.22, y * 0.35, Math.min(w, h) * 0.07).fill(0xe8a04a);
      decor.ellipse(w * 0.22, y * 0.35, Math.min(w, h) * 0.12, Math.min(w, h) * 0.025).stroke({ width: 3, color: 0xf2d29a });
    }
    if (sofa) {
      // Petit canapé contre le mur, au fond à gauche.
      const sp = room.floorToScreen({ x: -0.5, z: 0.12 });
      sp.x -= room.camX;
      const sw = sp.s * 1.1;
      const sh = sp.s * 0.42;
      decor.roundRect(sp.x - sw / 2, sp.y - sh, sw, sh * 0.7, 10).fill(SOFA.body);
      decor.roundRect(sp.x - sw / 2 - sw * 0.06, sp.y - sh * 0.6, sw * 0.14, sh * 0.6, 8).fill(SOFA.dark);
      decor.roundRect(sp.x + sw / 2 - sw * 0.08, sp.y - sh * 0.6, sw * 0.14, sh * 0.6, 8).fill(SOFA.dark);
      decor.roundRect(sp.x - sw * 0.42, sp.y - sh * 0.45, sw * 0.84, sh * 0.3, 6).fill(SOFA.cushion);
    }
  };
  let tint = 0;
  const drawNight = (): void => {
    night.clear();
    if (tint > 0) night.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x1f2546, alpha: tint });
  };
  drawRoom();
  app.ticker.add((tk) => falling.update(tk.deltaMS, season, windowRect, PuppyView.reduceMotion));
  app.renderer.on('resize', () => {
    drawRoom();
    drawNight();
  });

  return {
    app,
    room,
    world,
    setHour(hour, brightness) {
      const t = Math.round(nightAlpha(nightFactor(hour), brightness) * 100) / 100;
      if (t === tint) return;
      tint = t;
      drawNight();
    },
    setCamera(x) {
      room.camX = x;
      backdrop.x = x;
    },
    setSeason(next) {
      if (next === season) return;
      season = next;
      drawRoom();
    },
    setDecor(d, s) {
      if (d === decorId && s === sofa) return;
      decorId = d;
      sofa = s;
      app.renderer.background.color = PALETTES[d].wall;
      drawRoom();
    },
  };
}
