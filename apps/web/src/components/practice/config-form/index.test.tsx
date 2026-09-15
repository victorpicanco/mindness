import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TurnstileApi, TurnstileRenderOptions } from '@/components/ui/turnstile/types'
import {
  initialAuthActionState,
  initialStartGuestTrialState,
  type StartGuestTrialAction,
} from '@/lib/auth/action-state'

import { messages } from '@/i18n/messages'
import { DEFAULT_TIME_ZONE } from '@/i18n/request'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const { captureMock, resetMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  resetMock: vi.fn(),
}))

vi.mock('posthog-js', () => ({
  default: { capture: captureMock, reset: resetMock },
}))

function ApiProviders({ children }: { readonly children: ReactNode }) {
  const translate = useTranslations()
  const [queryClient] = useState(() => createQueryClient(translate))

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
import { ApiClientError } from '@/lib/api/client-error'
import { createQueryClient } from '@/lib/api/query-client'
import type { ApiErrorDescription } from '@/lib/errors/api-error-presentation'
import type { AuthenticationMode } from '@/components/auth/authentication-dialog'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'

import {
  PracticeConfigForm,
  type PracticeViewer,
  type StartSessionInput,
  type StartSessionRequest,
} from '@/components/practice/config-form'

const CATEGORIES = [
  { categoryId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa', name: 'Foco', slug: 'focus' },
]

const STARTED_SESSION = {
  createdAt: '2026-08-24T12:00:00.000Z',
  expiresAt: '2026-08-24T12:05:00.000Z',
  researchEndsAt: '2026-08-24T12:03:00.000Z',
  serverNow: '2026-08-24T12:00:00.000Z',
  sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
  themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
  themeTitle: 'Comunicação clara',
}

function PracticeSessionProbe() {
  const status = usePracticeSessionStore((state) => state.status)
  const session = usePracticeSessionStore((state) => state.session)

  return (
    <dl>
      <dt>status</dt>
      <dd>{status}</dd>
      <dt>theme</dt>
      <dd>{session === null ? 'none' : session.themeTitle}</dd>
    </dl>
  )
}

interface ConfigFormOverrides {
  readonly initialAuthenticationError?: ApiErrorDescription
  readonly initialAuthenticationMode?: AuthenticationMode | null
  readonly isTrialConsumed?: boolean
  readonly passwordUpdated?: boolean
  readonly startGuestTrial?: StartGuestTrialAction
  readonly viewer?: PracticeViewer
}

function renderPracticeConfigForm(
  startSession: StartSessionRequest,
  onSessionStarted?: (sessionId: string) => void,
  signOut: () => void = () => undefined,
  overrides: ConfigFormOverrides = {},
) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone={DEFAULT_TIME_ZONE}>
      <ApiProviders>
        <PracticeSessionProvider>
          <PracticeConfigForm
            categories={CATEGORIES}
            initialAuthenticationError={overrides.initialAuthenticationError}
            initialAuthenticationMode={overrides.initialAuthenticationMode ?? null}
            isTrialConsumed={overrides.isTrialConsumed ?? false}
            passwordUpdated={overrides.passwordUpdated ?? false}
            signInAction={() => Promise.resolve(initialAuthActionState)}
            signOut={signOut}
            signUpAction={() => Promise.resolve(initialAuthActionState)}
            startGuestTrial={
              overrides.startGuestTrial ?? (() => Promise.resolve(initialStartGuestTrialState))
            }
            startSession={startSession}
            viewer={overrides.viewer ?? 'registered'}
            {...(onSessionStarted === undefined ? {} : { onSessionStarted })}
          />
          <PracticeSessionProbe />
        </PracticeSessionProvider>
      </ApiProviders>
    </NextIntlClientProvider>,
  )
}

const widgets: { readonly container: HTMLElement; readonly options: TurnstileRenderOptions }[] = []

function installTurnstile(): void {
  window.turnstile = {
    render: (container, options) => {
      widgets.push({ container, options })

      return `widget-${String(widgets.length - 1)}`
    },
    remove: () => {},
    reset: () => {},
  } satisfies TurnstileApi
}

async function verifyGuestTrialCaptcha(token = 'captcha-token'): Promise<void> {
  const submit = await screen.findByRole('button', { name: 'Continuar sem conta' })
  const form = submit.closest('form')

  if (form === null) {
    expect(form).not.toBeNull()

    return
  }

  await waitFor(() => {
    expect(widgets.some((widget) => form.contains(widget.container))).toBe(true)
  })
  const widget = widgets.find((entry) => form.contains(entry.container))

  await act(() => {
    widget?.options.callback(token)

    return Promise.resolve()
  })
}

function submitConfiguration() {
  fireEvent.change(screen.getByLabelText('Dificuldade'), { target: { value: 'balanced' } })
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'focus' } })
  fireEvent.change(screen.getByLabelText('Tempo de pesquisa'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sessão' }))
}

function rejectingRequest(code: string): StartSessionRequest {
  return () =>
    Promise.reject(
      new ApiClientError({
        code,
        issues: null,
        message: 'The session could not be started.',
        requestId: null,
      }),
    )
}

beforeEach(() => {
  widgets.length = 0
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
  installTurnstile()
})

describe('PracticeConfigForm', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    delete window.turnstile
  })

  it('opens the authentication dialog instead of starting a session for a visitor', () => {
    const startSession = vi.fn<StartSessionRequest>(() => Promise.resolve(STARTED_SESSION))

    renderPracticeConfigForm(startSession, undefined, undefined, { viewer: 'visitor' })
    submitConfiguration()

    expect(startSession).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'É bom ter você de volta.' })).toBeInTheDocument()
    expect(screen.getByLabelText('Dificuldade')).toHaveValue('balanced')
    expect(screen.getByLabelText('Categoria')).toHaveValue('focus')
    expect(screen.getByLabelText('Tempo de pesquisa')).toHaveValue('4')
  })

  it('returns the focus to the start control when the visitor closes the authentication dialog', () => {
    renderPracticeConfigForm(() => Promise.resolve(STARTED_SESSION), undefined, undefined, {
      viewer: 'visitor',
    })
    submitConfiguration()

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Iniciar sessão' }))
  })

  it('starts the session directly when a visitor continues without an account', async () => {
    const requests: StartSessionInput[] = []
    const startGuestTrial = vi.fn<StartGuestTrialAction>(() =>
      Promise.resolve({ status: 'started' }),
    )

    renderPracticeConfigForm(
      (input) => {
        requests.push(input)

        return Promise.resolve(STARTED_SESSION)
      },
      undefined,
      undefined,
      { startGuestTrial, viewer: 'visitor' },
    )
    submitConfiguration()

    await verifyGuestTrialCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    await waitFor(() => {
      expect(requests).toHaveLength(1)
    })
    expect(startGuestTrial).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks a visitor for an account without opening another dialog when the trial was already used', async () => {
    renderPracticeConfigForm(() => Promise.resolve(STARTED_SESSION), undefined, undefined, {
      startGuestTrial: () => Promise.resolve({ status: 'account-required' }),
      viewer: 'visitor',
    })
    submitConfiguration()

    await verifyGuestTrialCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    expect(await screen.findByRole('dialog', { name: 'É bom ter você de volta.' })).toBeVisible()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Continuar sem conta' })).not.toBeInTheDocument()
    })
  })

  it('opens the authentication dialog already carrying a redirect error', async () => {
    const { toast } = await import('sonner')
    vi.mocked(toast.error).mockClear()

    renderPracticeConfigForm(() => Promise.resolve(STARTED_SESSION), undefined, undefined, {
      initialAuthenticationError: {
        messageKey: 'auth.errors.googleSignInFailed',
        presentation: 'toast',
      },
      initialAuthenticationMode: 'sign-in',
      viewer: 'visitor',
    })

    expect(screen.getByRole('dialog', { name: 'É bom ter você de volta.' })).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('opens the authentication dialog with the password-updated confirmation', () => {
    renderPracticeConfigForm(() => Promise.resolve(STARTED_SESSION), undefined, undefined, {
      initialAuthenticationMode: 'sign-in',
      passwordUpdated: true,
      viewer: 'visitor',
    })

    expect(screen.getByRole('dialog', { name: 'É bom ter você de volta.' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Senha atualizada. Entre novamente para continuar.',
    )
  })

  it.each<PracticeViewer>(['guest', 'registered'])(
    'starts the session directly for a %s viewer',
    async (viewer) => {
      const requests: StartSessionInput[] = []

      renderPracticeConfigForm(
        (input) => {
          requests.push(input)

          return Promise.resolve(STARTED_SESSION)
        },
        undefined,
        undefined,
        { viewer },
      )
      submitConfiguration()

      await waitFor(() => {
        expect(requests).toHaveLength(1)
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    },
  )

  it('opens the authentication dialog for a visitor whose browser already used the trial', () => {
    renderPracticeConfigForm(() => Promise.resolve(STARTED_SESSION), undefined, undefined, {
      isTrialConsumed: true,
      viewer: 'visitor',
    })
    submitConfiguration()

    expect(screen.getByRole('dialog', { name: 'É bom ter você de volta.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuar sem conta' })).not.toBeInTheDocument()
    expect(captureMock).not.toHaveBeenCalledWith('anonymous_trial_blocked')
  })

  it('opens the shared authentication dialog without a trial when the API refuses a second trial', async () => {
    const { toast } = await import('sonner')
    const startGuestTrial = vi.fn<StartGuestTrialAction>(() =>
      Promise.resolve(initialStartGuestTrialState),
    )

    renderPracticeConfigForm(
      rejectingRequest('sessions.GUEST_TRIAL_CONSUMED'),
      undefined,
      undefined,
      { startGuestTrial, viewer: 'guest' },
    )
    submitConfiguration()

    expect(
      await screen.findByRole('dialog', { name: 'É bom ter você de volta.' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByTestId('authentication-dialog-content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuar sem conta' })).not.toBeInTheDocument()
    expect(startGuestTrial).not.toHaveBeenCalled()
    expect(captureMock).toHaveBeenCalledWith('anonymous_trial_blocked')
    expect(toast.error).not.toHaveBeenCalled()
    expect(screen.getByText('idle')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Criar conta' }))

    expect(screen.getByRole('tab', { name: 'Criar conta' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.queryByRole('button', { name: 'Continuar sem conta' })).not.toBeInTheDocument()

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Iniciar sessão' }))
  })

  it('reports a blocked practice start to PostHog when consent is required again', async () => {
    renderPracticeConfigForm(rejectingRequest('sessions.PRACTICE_NOT_ALLOWED'))
    submitConfiguration()

    await screen.findByRole('alert')

    expect(captureMock).toHaveBeenCalledWith('practice_not_allowed')
  })

  it('reports the sign-out and resets the PostHog identity from the consent retry control', async () => {
    const signOut = vi.fn()
    renderPracticeConfigForm(rejectingRequest('sessions.PRACTICE_NOT_ALLOWED'), undefined, signOut)
    submitConfiguration()

    fireEvent.click(await screen.findByRole('button', { name: 'Sair e entrar de novo' }))

    expect(captureMock).toHaveBeenCalledWith('sign_out')
    expect(resetMock).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('moves the practice session store to researching with the started session', async () => {
    const requests: StartSessionInput[] = []
    const openedSessions: string[] = []
    const startSession: StartSessionRequest = (input) => {
      requests.push(input)

      return Promise.resolve(STARTED_SESSION)
    }

    renderPracticeConfigForm(startSession, (sessionId) => openedSessions.push(sessionId))
    submitConfiguration()

    await waitFor(() => {
      expect(screen.getByText('researching')).toBeInTheDocument()
    })
    expect(screen.getByText('Comunicação clara')).toBeInTheDocument()
    expect(requests).toEqual([
      { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
    ])
    expect(openedSessions).toEqual([STARTED_SESSION.sessionId])
  })

  it('explains that no theme is available for the chosen configuration', async () => {
    renderPracticeConfigForm(rejectingRequest('sessions.THEME_UNAVAILABLE'))
    submitConfiguration()

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('Não há tema disponível nessa combinação. Escolha outra opção.')
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('asks for the voice consent again without starting the session', async () => {
    renderPracticeConfigForm(rejectingRequest('sessions.PRACTICE_NOT_ALLOWED'))
    submitConfiguration()

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('Autorize a gravação e análise de voz para iniciar.')
    expect(screen.getByRole('button', { name: 'Sair e entrar de novo' })).toBeInTheDocument()
    expect(screen.getByText('idle')).toBeInTheDocument()
    expect(screen.getByText('none')).toBeInTheDocument()
  })

  it('toasts a failure that the form has no instruction for', async () => {
    const { toast } = await import('sonner')

    renderPracticeConfigForm(rejectingRequest('sessions.SOME_NEW_FAILURE'))
    submitConfiguration()

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Não foi possível concluir a ação. Tente novamente.',
      ),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('keeps a blocking failure inline instead of toasting it', async () => {
    const { toast } = await import('sonner')

    renderPracticeConfigForm(rejectingRequest('sessions.THEME_UNAVAILABLE'))
    submitConfiguration()

    await screen.findByRole('alert')

    expect(toast.error).not.toHaveBeenCalled()
  })

  it('submits the consent retry control to the sign-out action it was given', async () => {
    const signOut = vi.fn()

    renderPracticeConfigForm(rejectingRequest('sessions.PRACTICE_NOT_ALLOWED'), undefined, signOut)
    submitConfiguration()

    fireEvent.click(await screen.findByRole('button', { name: 'Sair e entrar de novo' }))

    expect(signOut).toHaveBeenCalledOnce()
  })
})
