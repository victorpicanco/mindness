import type {
  EligibleTheme,
  EligibleThemeCategory,
  ThemesPort,
} from '@/modules/sessions/domain/ports/themes-port/index.js'
import { readFile } from 'node:fs/promises'

import type { PrismaClient } from '@/generated/prisma/client.js'
import type {
  AccountPlan,
  AccountsPort,
} from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { SupabaseAudioStorageClient } from '@/modules/sessions/infrastructure/adapters/supabase-audio-storage-adapter/index.js'

import { FakeStorageObjectNotFoundError } from './errors.js'

type Difficulty = 'easy' | 'balanced' | 'hard'

const SESSIONS_TABLES = ['session_audios', 'sessions']

export interface FakeAccountsPort extends AccountsPort {
  registerIdentity(accessToken: string, accountId: string | null): void
  registerProfile(
    accountId: string,
    profile: { readonly plan: AccountPlan; readonly timeZone: string },
  ): void
  denyPractice(accountId: string): void
  reset(): void
}

export interface FakeThemesPort extends ThemesPort {
  registerEligibleTheme(input: {
    readonly categoryId?: string
    readonly categorySlug: string
    readonly categoryName?: string
    readonly difficulty: Difficulty
    readonly themeId: string
  }): void
  reset(): void
}

export interface InMemorySupabaseStorageClient extends SupabaseAudioStorageClient {
  putObject(path: string, buffer: Buffer): void
  hasObject(path: string): boolean
  isSignedUrlValidAt(url: string, at: Date): boolean
  reset(): void
}

interface Clock {
  now(): Date
}

function themeKey(categorySlug: string, difficulty: Difficulty): string {
  return `${categorySlug}:${difficulty}`
}

export function createFakeThemesPort(): FakeThemesPort {
  const themes = new Map<string, EligibleTheme>()
  const themesById = new Map<string, EligibleTheme>()
  const categories = new Map<string, EligibleThemeCategory>()

  return {
    drawEligibleTheme: ({ categorySlug, difficulty }) =>
      Promise.resolve(themes.get(themeKey(categorySlug, difficulty)) ?? null),
    findThemeById: (themeId) =>
      Promise.resolve(themesById.get(themeId) ?? { themeId, title: 'Theme' }),
    listCategories: () => Promise.resolve([...categories.values()]),
    listThemeTitles: (themeIds) =>
      Promise.resolve(
        themeIds.flatMap((themeId) => {
          const theme = themesById.get(themeId)

          return theme === undefined ? [] : [{ themeId, title: theme.title }]
        }),
      ),
    registerEligibleTheme: ({ categoryId, categorySlug, categoryName, difficulty, themeId }) => {
      const theme = { themeId, title: 'Theme' }
      themes.set(themeKey(categorySlug, difficulty), theme)
      themesById.set(themeId, theme)
      if (categoryId !== undefined && categoryName !== undefined) {
        categories.set(categoryId, { categoryId, slug: categorySlug, name: categoryName })
      }
    },
    reset: () => {
      themes.clear()
      themesById.clear()
      categories.clear()
    },
  }
}

export function createFakeAccountsPort(): FakeAccountsPort {
  const accountsByToken = new Map<string, string | null>()
  const profilesByAccountId = new Map<
    string,
    { readonly plan: AccountPlan; readonly timeZone: string }
  >()
  const deniedPracticeAccountIds = new Set<string>()

  return {
    resolveAccountId: (accessToken) => Promise.resolve(accountsByToken.get(accessToken) ?? null),
    findProfile: (accountId) => Promise.resolve(profilesByAccountId.get(accountId) ?? null),
    canStartPractice: (accountId) => Promise.resolve(!deniedPracticeAccountIds.has(accountId)),
    registerIdentity: (accessToken, accountId) => {
      accountsByToken.set(accessToken, accountId)
    },
    registerProfile: (accountId, profile) => {
      profilesByAccountId.set(accountId, profile)
    },
    denyPractice: (accountId) => {
      deniedPracticeAccountIds.add(accountId)
    },
    reset: () => {
      accountsByToken.clear()
      profilesByAccountId.clear()
      deniedPracticeAccountIds.clear()
    },
  }
}

export function createInMemorySupabaseStorageClient(clock?: Clock): InMemorySupabaseStorageClient {
  const objects = new Map<string, Buffer>()
  const storageClock = clock ?? { now: () => new Date() }

  function objectPath(directory: string, fileName: string): string {
    return directory.length === 0 ? fileName : `${directory}/${fileName}`
  }

  const fileApi = {
    createSignedUploadUrl: (path: string) =>
      Promise.resolve({
        data: { signedUrl: `memory://session-audio/${path}`, token: `token-${path}` },
        error: null,
      }),
    createSignedUrl: (path: string, expiresIn: number) => {
      const exists = objects.has(path)
      const expiresAt = storageClock.now().getTime() + expiresIn * 1_000

      return Promise.resolve({
        data: exists
          ? `memory://session-audio/${path}?token=token-${path}&expiresAt=${expiresAt}`
          : null,
        error: exists ? null : new FakeStorageObjectNotFoundError(),
      }).then((result) => ({
        data: result.data === null ? null : { signedUrl: result.data },
        error: result.error,
      }))
    },
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
    isSignedUrlValidAt: (url, at) => {
      try {
        const expiresAt = new URL(url).searchParams.get('expiresAt')
        if (expiresAt === null) return false

        const expiresAtMs = Number(expiresAt)
        return Number.isFinite(expiresAtMs) && at.getTime() <= expiresAtMs
      } catch {
        return false
      }
    },
    reset: () => {
      objects.clear()
    },
  }
}

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
