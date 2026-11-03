/**
 * Accumulateur à pas fixe : la simulation avance par pas constants,
 * quelle que soit la cadence d'affichage.
 */
export class FixedStepper {
  private acc = 0;

  constructor(
    private readonly stepMs: number,
    private readonly maxSteps: number,
    private readonly onStep: (dtMs: number) => void,
  ) {}

  /** Fraction du pas en cours, pour interpoler le rendu. */
  get alpha(): number {
    return this.acc / this.stepMs;
  }

  advance(elapsedMs: number): void {
    if (!(elapsedMs > 0)) return;
    this.acc = Math.min(this.acc + elapsedMs, this.stepMs * this.maxSteps);
    while (this.acc >= this.stepMs) {
      this.acc -= this.stepMs;
      this.onStep(this.stepMs);
    }
  }
}
