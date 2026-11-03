import { Application, Container, Graphics } from 'pixi.js';
import type { DecorId } from '../sim/state';
import { Room } from './room';

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
  setHour(hour: number): void;
  /** Décor du salon et canapé (déblocages). */
  setDecor(decor: DecorId, sofa: boolean): void;
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
  app.stage.addChild(decor, world, night);

  let decorId: DecorId = 'home';
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
    if (tint > 0) night.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x1f2546, alpha: 0.38 * tint });
  };
  drawRoom();
  app.renderer.on('resize', () => {
    drawRoom();
    drawNight();
  });

  return {
    app,
    room,
    world,
    setHour(hour) {
      const t = Math.round(nightFactor(hour) * 50) / 50;
      if (t === tint) return;
      tint = t;
      drawNight();
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
