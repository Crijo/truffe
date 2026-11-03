import { describe, expect, it } from 'vitest';
import { Camera, Spring, angleDiff, mul, rotX, rotY } from '../../src/render/puppy/math';

describe('Projection des ellipsoïdes', () => {
  const flat = new Camera(0);

  it('une sphère donne un cercle de même rayon', () => {
    const e = flat.ellipse(rotY(0.7), [0.3, 0.3, 0.3]);
    expect(e.a).toBeCloseTo(0.3);
    expect(e.b).toBeCloseTo(0.3);
  });

  it('un corps allongé vu de profil paraît long, vu de face paraît étroit', () => {
    const side = flat.ellipse(rotY(Math.PI / 2), [0.2, 0.25, 0.4]);
    expect(side.a).toBeCloseTo(0.4);
    expect(side.b).toBeCloseTo(0.25);
    expect(Math.abs(side.rot)).toBeCloseTo(0);
    const front = flat.ellipse(rotY(0), [0.2, 0.25, 0.4]);
    expect(front.a).toBeCloseTo(0.25);
    expect(front.b).toBeCloseTo(0.2);
  });

  it('un corps cabré de profil (assis) penche son grand axe', () => {
    const sit = flat.ellipse(mul(rotY(Math.PI / 2), rotX(0.5)), [0.2, 0.25, 0.4]);
    expect(sit.a).toBeCloseTo(0.4, 1);
    expect(Math.abs(sit.rot)).toBeCloseTo(0.5, 1);
  });

  it('caméra plongeante : un point plus proche du joueur paraît plus bas', () => {
    const cam = new Camera(0.35);
    expect(cam.project([0, 0, 1]).y).toBeGreaterThan(cam.project([0, 0, 0]).y);
  });

  it('un ressort raide reste stable avec des images longues', () => {
    const s = new Spring(0);
    for (let i = 0; i < 100; i++) s.step(1, 0.05, 34);
    expect(s.x).toBeCloseTo(1, 3);
  });

  it('angleDiff prend le plus court chemin', () => {
    expect(angleDiff(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleDiff(0, 1)).toBeCloseTo(1);
  });
});
