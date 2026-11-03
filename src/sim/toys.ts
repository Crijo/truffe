/**
 * Jouets lancés (F-JEU-1) : balle, disque, corde.
 * x et z en unités de sol par seconde, hauteur h en unités du chiot.
 */
import { BALANCE } from '../data/balance';
import type { Vec2 } from './behavior';

export type ToyKind = 'ball' | 'disc' | 'rope';
/** held : dans la main du joueur ; carried : dans la gueule ; tug : tiré des deux côtés. */
export type ToyState = 'held' | 'flying' | 'ground' | 'carried' | 'tug';

export interface Toy {
  id: string;
  kind: ToyKind;
  state: ToyState;
  pos: Vec2;
  h: number;
  v: { x: number; z: number; h: number };
  carrier: string | null;
}

const T = BALANCE.toys;
const F = BALANCE.puppy.floor;

export function createToy(id: string, kind: ToyKind, at: Vec2): Toy {
  return { id, kind, state: 'held', pos: { ...at }, h: 0.5, v: { x: 0, z: 0, h: 0 }, carrier: null };
}

/** Lance un jouet tenu avec la vitesse du doigt, projetée sur le sol. */
export function throwToy(toy: Toy, vx: number, vz: number, _t: number): Toy {
  let x = vx;
  let z = vz;
  const speed = Math.hypot(x, z);
  if (speed > T.maxSpeed) {
    x *= T.maxSpeed / speed;
    z *= T.maxSpeed / speed;
  }
  const sp = Math.min(speed, T.maxSpeed);
  const vh = toy.kind === 'disc' ? 1 + 0.3 * sp : 1.3 + 0.55 * sp;
  return { ...toy, state: 'flying', carrier: null, h: Math.max(toy.h, 0.3), v: { x, z, h: vh } };
}

export function stepToy(toy: Toy, dtMs: number): Toy {
  if (toy.state !== 'flying' && toy.state !== 'ground') return toy;
  const dt = dtMs / 1000;
  const t: Toy = { ...toy, pos: { ...toy.pos }, v: { ...toy.v } };
  const air = t.h > 0 || t.v.h > 0;
  if (air) {
    if (t.kind === 'disc') {
      t.v.x *= 1 - T.discDrag * dt;
      t.v.z *= 1 - T.discDrag * dt;
    }
    t.v.h -= T.gravity[t.kind] * dt;
    t.h += t.v.h * dt;
  }
  t.pos.x += t.v.x * dt;
  t.pos.z += t.v.z * dt;

  // Murs du salon.
  if (t.pos.x < F.minX || t.pos.x > F.maxX) {
    t.pos.x = Math.min(F.maxX, Math.max(F.minX, t.pos.x));
    t.v.x = -t.v.x * 0.5;
  }
  if (t.pos.z < F.minZ) {
    t.pos.z = F.minZ;
    t.v.z = -t.v.z * 0.5;
  }
  if (t.pos.z > F.maxZ) {
    t.pos.z = F.maxZ;
    t.v.z = 0;
  }

  // Sol : rebond, puis roulement freiné.
  if (t.h <= 0) {
    t.h = 0;
    if (t.kind === 'ball' && t.v.h < -0.6) {
      t.v.h = -t.v.h * T.bounce;
      t.v.x *= 0.75;
      t.v.z *= 0.75;
    } else {
      t.v.h = 0;
      t.state = 'ground';
      const speed = Math.hypot(t.v.x, t.v.z);
      const friction = T.rollFriction * (t.kind === 'ball' ? 1 : 4) * dt;
      if (speed <= friction || speed < 0.02) {
        t.v.x = 0;
        t.v.z = 0;
      } else {
        t.v.x *= 1 - friction / speed;
        t.v.z *= 1 - friction / speed;
      }
    }
  }
  return t;
}
