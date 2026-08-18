import { InvalidQuotaValueError } from '@/modules/quota/domain/errors/invalid-quota-value-error/index.js'

export const CYCLE_LENGTH_DAYS = 30

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const CYCLE_LENGTH_MILLISECONDS = CYCLE_LENGTH_DAYS * MILLISECONDS_PER_DAY

export class CycleWindow {
  private constructor(
    private readonly startsAtEpoch: number,
    private readonly renewsAtEpoch: number,
  ) {}

  get startsAt(): Date {
    return new Date(this.startsAtEpoch)
  }

  get renewsAt(): Date {
    return new Date(this.renewsAtEpoch)
  }

  static create(startsAt: Date): CycleWindow {
    const startsAtEpoch = startsAt.getTime()

    if (!Number.isFinite(startsAtEpoch)) {
      throw new InvalidQuotaValueError('startsAt')
    }

    return new CycleWindow(startsAtEpoch, startsAtEpoch + CYCLE_LENGTH_MILLISECONDS)
  }

  static reconstitute(startsAt: Date, renewsAt: Date): CycleWindow {
    return new CycleWindow(startsAt.getTime(), renewsAt.getTime())
  }

  contains(instant: Date): boolean {
    const instantEpoch = instant.getTime()

    return instantEpoch >= this.startsAtEpoch && instantEpoch < this.renewsAtEpoch
  }

  previous(): CycleWindow {
    return CycleWindow.create(new Date(this.startsAtEpoch - CYCLE_LENGTH_MILLISECONDS))
  }

  advanceTo(instant: Date): CycleWindow {
    const elapsedCycles = Math.max(
      0,
      Math.floor((instant.getTime() - this.startsAtEpoch) / CYCLE_LENGTH_MILLISECONDS),
    )

    return CycleWindow.create(
      new Date(this.startsAtEpoch + elapsedCycles * CYCLE_LENGTH_MILLISECONDS),
    )
  }

  equals(other: CycleWindow): boolean {
    return this.startsAtEpoch === other.startsAtEpoch && this.renewsAtEpoch === other.renewsAtEpoch
  }
}
