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
  /** Calque du chiot. */
  world: Container;
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
  app.stage.addChild(decor, world);

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
  drawRoom();
  app.renderer.on('resize', drawRoom);

  return { app, room, world };
}
