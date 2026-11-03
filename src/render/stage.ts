import { Application, Container, Graphics } from 'pixi.js';
import { Room } from './room';

/** Palette du salon : aplats doux de livre illustré. */
const ROOM = {
  wall: 0xf6e7d0,
  wallShade: 0xefdcc1,
  baseboard: 0xfbf5ec,
  floor: 0xe2b98b,
  floorLine: 0xd6a978,
  rug: 0xc7d6c0,
  rugEdge: 0xb5c8ad,
} as const;

export interface Stage {
  app: Application;
  room: Room;
  /** Calque du chiot et des objets au sol, trié par profondeur. */
  world: Container;
  /** Teinte selon l'heure locale (décor qui change discrètement). */
  setHour(hour: number): void;
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

  const drawRoom = (): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    room.layout(w, h);
    const y = room.horizon;
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
  };
}
