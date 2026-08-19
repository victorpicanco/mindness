import type {
  EligibleTheme,
  ThemesPort,
} from '@/modules/sessions/domain/ports/themes-port/index.js'
import type {
  QuotaPort,
  QuotaReservation,
  ReleaseQuotaReservationInput,
  ReserveQuotaForSessionInput,
} from '@/modules/sessions/domain/ports/quota-port/index.js'
import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

type Difficulty = 'easy' | 'balanced' | 'hard'

export interface FakeThemesPort extends ThemesPort {
  registerEligibleTheme(input: {
    readonly categorySlug: string
    readonly difficulty: Difficulty
    readonly themeId: string
  }): void
  reset(): void
}

export interface FakeQuotaPort extends QuotaPort {
  readonly reserveCalls: readonly ReserveQuotaForSessionInput[]
  readonly releaseCalls: readonly ReleaseQuotaReservationInput[]
  configure(input: { readonly enforced: boolean; readonly remaining?: number }): void
  failNextReservation(): void
  reset(): void
}

class FakeQuotaExhaustedError extends ConflictError {
  readonly code = 'quota.QUOTA_EXHAUSTED'

  constructor() {
    super('Quota is exhausted')
  }
}

function themeKey(categorySlug: string, difficulty: Difficulty): string {
  return `${categorySlug}:${difficulty}`
}

export function createFakeThemesPort(): FakeThemesPort {
  const themes = new Map<string, EligibleTheme>()

  return {
    drawEligibleTheme: ({ categorySlug, difficulty }) =>
      Promise.resolve(themes.get(themeKey(categorySlug, difficulty)) ?? null),
    registerEligibleTheme: ({ categorySlug, difficulty, themeId }) => {
      themes.set(themeKey(categorySlug, difficulty), { themeId })
    },
    reset: () => {
      themes.clear()
    },
  }
}

export function createFakeQuotaPort(): FakeQuotaPort {
  const reserveCalls: ReserveQuotaForSessionInput[] = []
  const releaseCalls: ReleaseQuotaReservationInput[] = []
  let enforced = true
  let remaining = 4
  let failNext = false

  function reserveForSession(input: ReserveQuotaForSessionInput): Promise<QuotaReservation> {
    reserveCalls.push(input)

    if (failNext) {
      failNext = false
      return Promise.reject(new FakeQuotaExhaustedError())
    }

    if (enforced && remaining === 0) return Promise.reject(new FakeQuotaExhaustedError())
    if (enforced) remaining -= 1

    return Promise.resolve({
      reservationId: `reservation-${input.sessionId}`,
      enforced,
      remaining: enforced ? remaining : null,
    })
  }

  return {
    reserveCalls,
    releaseCalls,
    reserveForSession,
    releaseReservation: (input) => {
      releaseCalls.push(input)
      return Promise.resolve()
    },
    configure: (input) => {
      enforced = input.enforced
      remaining = input.enforced ? (input.remaining ?? 4) : 0
    },
    failNextReservation: () => {
      failNext = true
    },
    reset: () => {
      reserveCalls.length = 0
      releaseCalls.length = 0
      enforced = true
      remaining = 4
      failNext = false
    },
  }
}
