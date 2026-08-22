import { InvalidPillarScoreError } from '@/modules/analyses/domain/errors/invalid-pillar-score-error/index.js'

export class PillarScore {
  private constructor(readonly value: number) {}

  static create(value: number): PillarScore {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new InvalidPillarScoreError(value)
    }

    return new PillarScore(value)
  }

  equals(other: PillarScore): boolean {
    return this.value === other.value
  }
}
