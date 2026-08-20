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
import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'
import type { PrismaClient } from '@/generated/prisma/client.js'
import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { SupabaseAudioStorageClient } from '@/modules/sessions/infrastructure/adapters/supabase-audio-storage-adapter/index.js'

type Difficulty = 'easy' | 'balanced' | 'hard'

const SESSIONS_TABLES = ['session_audios', 'sessions']

export interface FakeAccountsPort extends AccountsPort {
  registerIdentity(accessToken: string, accountId: string | null): void
  reset(): void
}

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

export interface InMemorySupabaseStorageClient extends SupabaseAudioStorageClient {
  putObject(path: string, buffer: Buffer): void
  hasObject(path: string): boolean
  reset(): void
}

class FakeQuotaExhaustedError extends ConflictError {
  readonly code = 'quota.QUOTA_EXHAUSTED'

  constructor() {
    super('Quota is exhausted')
  }
}

class FakeStorageObjectNotFoundError extends InfrastructureError {
  readonly code = 'sessions.FAKE_STORAGE_OBJECT_NOT_FOUND'

  constructor() {
    super('Audio object was not found')
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

export function createFakeAccountsPort(): FakeAccountsPort {
  const accountsByToken = new Map<string, string | null>()

  return {
    resolveAccountId: (accessToken) => Promise.resolve(accountsByToken.get(accessToken) ?? null),
    registerIdentity: (accessToken, accountId) => {
      accountsByToken.set(accessToken, accountId)
    },
    reset: () => {
      accountsByToken.clear()
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
      reservationId: input.sessionId,
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

export function createInMemorySupabaseStorageClient(): InMemorySupabaseStorageClient {
  const objects = new Map<string, Buffer>()

  function objectPath(directory: string, fileName: string): string {
    return directory.length === 0 ? fileName : `${directory}/${fileName}`
  }

  const fileApi = {
    createSignedUploadUrl: (path: string) =>
      Promise.resolve({
        data: { signedUrl: `memory://session-audio/${path}`, token: `token-${path}` },
        error: null,
      }),
    list: (directory: string, options: { readonly search: string }) => {
      const path = objectPath(directory, options.search)
      const buffer = objects.get(path)
      return Promise.resolve({
        data:
          buffer === undefined
            ? []
            : [{ name: options.search, metadata: { size: buffer.byteLength } }],
        error: null,
      })
    },
    download: (path: string) => {
      const buffer = objects.get(path)
      return Promise.resolve({
        data: buffer === undefined ? null : new Blob([Uint8Array.from(buffer)]),
        error: buffer === undefined ? new FakeStorageObjectNotFoundError() : null,
      })
    },
    remove: (paths: string[]) => {
      for (const path of paths) objects.delete(path)
      return Promise.resolve({ data: paths, error: null })
    },
  }

  return {
    storage: { from: () => fileApi },
    putObject: (path, buffer) => {
      objects.set(path, Buffer.from(buffer))
    },
    hasObject: (path) => objects.has(path),
    reset: () => {
      objects.clear()
    },
  }
}

export function clearSessionsData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${SESSIONS_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}
