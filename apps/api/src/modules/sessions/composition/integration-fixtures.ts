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
import { readFile } from 'node:fs/promises'

import type { PrismaClient } from '@/generated/prisma/client.js'
import type {
  AccountPlan,
  AccountsPort,
} from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { SupabaseAudioStorageClient } from '@/modules/sessions/infrastructure/adapters/supabase-audio-storage-adapter/index.js'

import { FakeQuotaExhaustedError, FakeStorageObjectNotFoundError } from './errors.js'

type Difficulty = 'easy' | 'balanced' | 'hard'

const SESSIONS_TABLES = ['session_audios', 'sessions']

export interface FakeAccountsPort extends AccountsPort {
  registerIdentity(accessToken: string, accountId: string | null): void
  registerProfile(
    accountId: string,
    profile: { readonly plan: AccountPlan; readonly timeZone: string },
  ): void
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
  const profilesByAccountId = new Map<
    string,
    { readonly plan: AccountPlan; readonly timeZone: string }
  >()

  return {
    resolveAccountId: (accessToken) => Promise.resolve(accountsByToken.get(accessToken) ?? null),
    findProfile: (accountId) => Promise.resolve(profilesByAccountId.get(accountId) ?? null),
    registerIdentity: (accessToken, accountId) => {
      accountsByToken.set(accessToken, accountId)
    },
    registerProfile: (accountId, profile) => {
      profilesByAccountId.set(accountId, profile)
    },
    reset: () => {
      accountsByToken.clear()
      profilesByAccountId.clear()
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
    // Supabase filters `search` as a prefix over the names inside the directory.
    list: (directory: string, options: { readonly search: string }) => {
      const prefix = objectPath(directory, options.search)
      const matches = [...objects.entries()]
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, buffer]) => ({
          name: directory.length === 0 ? path : path.slice(directory.length + 1),
          metadata: { size: buffer.byteLength },
        }))

      return Promise.resolve({ data: matches, error: null })
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

// The decodable-audio fixtures live beside the adapter that is tested against them; reading
// them through here keeps the integration suites from reaching across three folder levels.
export function readAudioFixture(name: string): Promise<Buffer> {
  return readFile(
    new URL(
      `../infrastructure/adapters/ffmpeg-audio-validation-adapter/fixtures/${name}`,
      import.meta.url,
    ),
  )
}

export function clearSessionsData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${SESSIONS_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export {
  assertResponseMatchesSchema,
  type InjectedResponse,
} from '@/shared/http/openapi-response-assertion/index.js'
