import { Application, Container, Graphics } from 'pixi.js';

/** Palette du salon : aplats doux de livre illustré. */
const ROOM = {
  wall: 0xf6e7d0,
  wallShade: 0xefdcc1,
  baseboard: 0xfbf5ec,
  floor: 0xe2b98b,
  floorLine: 0xd6a978,
  rug: 0xc7d6c0,
} as const;

/** Part de la hauteur occupée par le mur. */
const HORIZON = 0.55;

export interface Stage {
  app: Application;
  /** Calque où vivra le chiot (jalon 1). */
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

  const room = new Graphics();
  const world = new Container();
  app.stage.addChild(room, world);

  const drawRoom = (): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    const y = Math.round(h * HORIZON);
    room.clear();
    room.rect(0, 0, w, y).fill(ROOM.wall);
    room.rect(0, y - h * 0.18, w, h * 0.18).fill(ROOM.wallShade);
    room.rect(0, y, w, h - y).fill(ROOM.floor);
    for (let i = 1; i < 5; i++) {
      const ly = y + (h - y) * (i / 5) ** 1.4;
      room.rect(0, ly, w, 2).fill(ROOM.floorLine);
    }
    room.rect(0, y - 6, w, 12).fill(ROOM.baseboard);
    room.ellipse(w / 2, y + (h - y) * 0.55, w * 0.42, (h - y) * 0.28).fill(ROOM.rug);
  };
  drawRoom();
  app.renderer.on('resize', drawRoom);

  return { app, world };
}
