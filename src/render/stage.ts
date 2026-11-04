import { Application, Container, Graphics } from 'pixi.js';
import type { DecorId } from '../sim/state';
import { nightAlpha } from '../sim/needs';
import { SEASONS, type Season } from '../data/seasons';
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
  app.stage.addChild(decor, pane, falling.g, world, night);

  let decorId: DecorId = 'home';
  let season: Season = 'summer';
  let windowRect = { x: 0, y: 0, w: 0, h: 0 };
  let sofa = false;
  const drawRoom = (): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    room.layout(w, h);
    const y = room.horizon;
    const ROOM = PALETTES[decorId];
    decor.clear();
    decor.rect(0, 0, w, y).fill(ROOM.wall);
    decor.rect(0, y - h * 0.18, w, h * 0.18).fill(ROOM.wallShade);
    decor.rect(0, y, w, h - y).fill(ROOM.floor);
    for (let i = 1; i < 5; i++) {
      const ly = y + (h - y) * (i / 5) ** 1.4;
      decor.rect(0, ly, w, 2).fill(ROOM.floorLine);
    }
    decor.rect(0, y - 6, w, 12).fill(ROOM.baseboard);
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
      decor.rect(fx + fw / 2 - 3, fy, 6, fh).fill(ROOM.baseboard);
      decor.rect(fx, fy + fh / 2 - 3, fw, 6).fill(ROOM.baseboard);
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
