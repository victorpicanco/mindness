import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

import { messages } from '@/i18n/messages'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'

const categories = [
  { categoryId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa', name: 'Foco', slug: 'focus' },
]

const requestedPaths: string[] = []
const redirects: string[] = []
let activeSession: unknown = null
let isAuthenticated = false
let accountProfile: unknown = null
let isTrialUsed = false

const REGISTERED_PROFILE = {
  accountId: '4ff569a3-bffc-4b5d-bbb2-662ebf994a85',
  accountKind: 'registered',
  authenticationMethod: 'password',
  consent: null,
  createdAt: '2026-08-24T11:00:00.000Z',
  email: 'person@example.com',
  name: null,
  plan: 'free',
  timeZone: 'America/Sao_Paulo',
}

const PRACTICE_TRANSLATIONS: Readonly<Record<string, string>> = {
  categoryLabel: 'Categoria',
  categoryPlaceholder: 'Escolha a categoria',
  difficultyLabel: 'Dificuldade',
  difficultyPlaceholder: 'Escolha a dificuldade',
  searchWindowLabel: 'Tempo de pesquisa',
  searchWindowPlaceholder: 'Escolha o tempo',
  startSession: 'Iniciar sessão',
  title: 'Qual será o assunto de hoje?',
}

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('next/cache', () => ({ cacheLife: () => undefined }))
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        isTrialUsed && name === 'mindness_guest_trial_used' ? { value: 'true' } : undefined,
    }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => PRACTICE_TRANSLATIONS[key] ?? ''),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirects.push(path)

    throw new DOMException('Redirected', 'RedirectError')
  },
  useRouter: () => ({
    back: () => undefined,
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
  }),
}))

vi.mock('@/lib/api/server-client', () => ({
  apiFetchIfAuthenticated: <TSchema extends z.ZodType>(
    path: string,
    options: { readonly schema: TSchema },
  ) => {
    if (!isAuthenticated) return Promise.resolve(null)

    requestedPaths.push(path)

    return Promise.resolve(
      options.schema.parse(path === '/accounts/me' ? accountProfile : activeSession),
    )
  },
  publicApiFetch: <TSchema extends z.ZodType>(
    path: string,
    options: { readonly schema: TSchema },
  ) => {
    requestedPaths.push(path)

    return Promise.resolve(options.schema.parse(categories))
  },
}))

function renderPage(page: ReactElement) {
  const router = {
    back: () => undefined,
    bfcacheId: 'test-bfcache-id',
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
  }

  return render(
    <AppRouterContext.Provider value={router}>
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <PracticeSessionProvider>{page}</PracticeSessionProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>,
  )
}

function startConfiguredSession() {
  fireEvent.change(screen.getByLabelText('Dificuldade'), { target: { value: 'balanced' } })
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'focus' } })
  fireEvent.change(screen.getByLabelText('Tempo de pesquisa'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sessão' }))
}

async function loadHomePage() {
  return (await import('./page')).default
}

function searchParamsOf(params: Record<string, string | string[] | undefined> = {}): {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
} {
  return { searchParams: Promise.resolve(params) }
}

describe('HomePage', () => {
  beforeEach(() => {
    requestedPaths.length = 0
    redirects.length = 0
    activeSession = null
    accountProfile = REGISTERED_PROFILE
    isAuthenticated = false
    isTrialUsed = false
  })

  afterEach(cleanup)

  it('loads only public categories for a visitor', async () => {
    const HomePage = await loadHomePage()
    const rendered = HomePage(searchParamsOf())

    expect(requestedPaths).toEqual(['/sessions/theme-categories'])

    await rendered
  })

  it('loads the active session for an authenticated viewer', async () => {
    isAuthenticated = true
    const HomePage = await loadHomePage()
    const rendered = HomePage(searchParamsOf())

    expect(requestedPaths).toEqual([
      '/sessions/theme-categories',
      '/accounts/me',
      '/sessions/active',
    ])

    await rendered
  })

  it('shows the available categories', async () => {
    const HomePage = await loadHomePage()

    renderPage(await HomePage(searchParamsOf()))

    expect(screen.getByRole('heading', { name: 'Qual será o assunto de hoje?' })).toHaveClass(
      'font-(family-name:--font-buenard)',
    )
    expect(screen.getByRole('option', { name: 'Foco' })).toBeInTheDocument()
  })

  it('opens authentication before creating a session for a visitor', async () => {
    const HomePage = await loadHomePage()

    renderPage(await HomePage(searchParamsOf()))
    startConfiguredSession()

    expect(screen.getByRole('dialog', { name: 'É bom ter você de volta.' })).toBeInTheDocument()
  })

  it('opens authentication for a visitor whose browser already used the trial', async () => {
    isTrialUsed = true
    const HomePage = await loadHomePage()

    renderPage(await HomePage(searchParamsOf()))
    startConfiguredSession()

    expect(screen.getByRole('dialog', { name: 'É bom ter você de volta.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuar sem conta' })).not.toBeInTheDocument()
  })

  it('redirects an active session from the creation route to its canonical URL', async () => {
    isAuthenticated = true
    activeSession = {
      configuration: { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
      createdAt: '2026-08-24T11:50:00.000Z',
      expiresAt: '2026-08-24T12:05:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:03:00.000Z',
      serverNow: '2026-08-24T12:00:00.000Z',
      sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
      themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
      themeTitle: 'Comunicação clara',
    }

    const HomePage = await loadHomePage()

    await expect(HomePage(searchParamsOf())).rejects.toMatchObject({ name: 'RedirectError' })
    expect(redirects).toEqual(['/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'])
  })

  it('opens authentication already carrying a redirect error for a visitor', async () => {
    const { toast } = await import('sonner')
    vi.mocked(toast.error).mockClear()

    const HomePage = await loadHomePage()

    renderPage(await HomePage(searchParamsOf({ error: 'google_callback_failed' })))

    expect(screen.getByRole('dialog', { name: 'É bom ter você de volta.' })).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('opens authentication with the password-updated confirmation for a visitor', async () => {
    const HomePage = await loadHomePage()

    renderPage(await HomePage(searchParamsOf({ status: 'password-updated' })))

    expect(screen.getByRole('dialog', { name: 'É bom ter você de volta.' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Senha atualizada. Entre novamente para continuar.',
    )
  })
})
