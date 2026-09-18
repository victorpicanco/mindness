import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AlertDialogProvider } from '@/components/providers/alert-dialog-provider'
import type { TurnstileApi, TurnstileRenderOptions } from '@/components/ui/turnstile/types'
import type {
  BrowserAnalyticsClient,
  BrowserAnalyticsProperties,
} from '@/lib/analytics/browser-client'
import { messages } from '@/i18n/messages'
import {
  initialStartGuestTrialState,
  type StartGuestTrialAction,
  type StartGuestTrialState,
} from '@/lib/auth/action-state'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { dismissAlertDialog } from '@/lib/feedback/alert-dialog'

import { GuestTrialForm } from './index'

const widgets: TurnstileRenderOptions[] = []

function installTurnstile(): void {
  const api: TurnstileApi = {
    render: (_container, options) => {
      widgets.push(options)

      return `widget-${String(widgets.length - 1)}`
    },
    remove: () => {},
    reset: () => {},
  }

  window.turnstile = api
}

async function verifyCaptcha(token = 'captcha-token'): Promise<void> {
  await waitFor(() => {
    expect(widgets).not.toHaveLength(0)
  })
  await act(() => {
    widgets[0]?.callback(token)

    return Promise.resolve()
  })
}

type FormOverrides = {
  readonly analytics?: BrowserAnalyticsClient
  readonly appearance?: 'compact' | 'default' | undefined
  readonly onAccountRequired?: () => void
  readonly onStarted?: () => void
  readonly startGuestTrial?: StartGuestTrialAction
}

interface RecordingBrowserAnalytics extends BrowserAnalyticsClient {
  readonly events: { readonly event: string; readonly properties?: BrowserAnalyticsProperties }[]
}

function createRecordingAnalytics(): RecordingBrowserAnalytics {
  const events: RecordingBrowserAnalytics['events'] = []

  return {
    capture: (event, properties) => {
      events.push(properties === undefined ? { event } : { event, properties })
    },
    events,
    getDistinctId: () => 'browser-anonymous-id',
    reset: () => undefined,
  }
}

function renderGuestTrialForm(overrides: FormOverrides = {}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <GuestTrialForm
        analytics={overrides.analytics ?? createRecordingAnalytics()}
        appearance={overrides.appearance}
        onAccountRequired={overrides.onAccountRequired ?? (() => undefined)}
        onStarted={overrides.onStarted ?? (() => undefined)}
        startGuestTrial={
          overrides.startGuestTrial ?? (() => Promise.resolve(initialStartGuestTrialState))
        }
      />
      <AlertDialogProvider />
    </NextIntlClientProvider>,
  )
}

function respondWith(state: StartGuestTrialState): StartGuestTrialAction {
  return () => Promise.resolve(state)
}

beforeEach(async () => {
  const { toast } = await import('sonner')
  vi.mocked(toast.error).mockClear()
  widgets.length = 0
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
  installTurnstile()
})

afterEach(() => {
  act(() => {
    dismissAlertDialog()
  })
  cleanup()
  vi.unstubAllEnvs()
  delete window.turnstile
})

describe('GuestTrialForm', () => {
  it('sends the captcha token to the guest trial action and reports the started trial', async () => {
    const submitted: FormData[] = []
    const onStarted = vi.fn()
    const analytics = createRecordingAnalytics()

    renderGuestTrialForm({
      analytics,
      onStarted,
      startGuestTrial: (_state, formData) => {
        submitted.push(formData)

        return Promise.resolve({ status: 'started' })
      },
    })

    await verifyCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledOnce()
    })
    expect(submitted[0]?.get('captchaToken')).toBe('captcha-token')
    expect(submitted[0]?.get('anonymousDistinctId')).toBe('browser-anonymous-id')
    expect(analytics.events).toContainEqual({ event: 'anonymous_trial_selected' })
  })

  it('raises a rate limit as a toast, not next to the control', async () => {
    const { toast } = await import('sonner')
    const onStarted = vi.fn()

    renderGuestTrialForm({
      onStarted,
      startGuestTrial: respondWith({
        status: 'api-error',
        error: { code: 'accounts.RATE_LIMITED', issues: null, requestId: null },
      }),
    })

    await verifyCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Tentativas demais em pouco tempo. Aguarde um minuto e tente de novo.',
      )
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onStarted).not.toHaveBeenCalled()
  })

  it('raises a default application failure as a toast, not next to the control', async () => {
    const { toast } = await import('sonner')

    renderGuestTrialForm({
      startGuestTrial: respondWith({
        status: 'api-error',
        error: { code: 'shared.INTERNAL_ERROR', issues: null, requestId: null },
      }),
    })

    await verifyCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Não foi possível concluir a ação. Tente novamente.')
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps a rejected captcha inline, next to the control', async () => {
    const { toast } = await import('sonner')

    renderGuestTrialForm({
      startGuestTrial: respondWith({
        status: 'api-error',
        error: { code: 'accounts.CAPTCHA_REJECTED', issues: null, requestId: null },
      }),
    })

    await verifyCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir a verificação de segurança. Tente novamente.',
    )
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('keeps a missing captcha token inline, next to the control, with the field-validation copy', async () => {
    const { toast } = await import('sonner')

    renderGuestTrialForm({
      startGuestTrial: respondWith({ status: 'captcha-required' }),
    })

    await verifyCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Conclua a verificação de segurança para continuar.',
    )
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('raises a blocking failure as a dialog, not next to the control', async () => {
    renderGuestTrialForm({
      startGuestTrial: respondWith({
        status: 'api-error',
        error: { code: 'sessions.SESSION_NOT_IN_PROGRESS', issues: null, requestId: null },
      }),
    })

    await verifyCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    expect(
      await screen.findByRole('dialog', { name: 'Não foi possível continuar' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('never renders an inline error bound to a field this control does not have', async () => {
    renderGuestTrialForm({
      startGuestTrial: respondWith({
        status: 'api-error',
        error: { code: 'accounts.ACCOUNT_ALREADY_EXISTS', issues: null, requestId: null },
      }),
    })

    await verifyCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('asks for an account when the action finds the trial already consumed', async () => {
    const onAccountRequired = vi.fn()

    renderGuestTrialForm({
      onAccountRequired,
      startGuestTrial: respondWith({ status: 'account-required' }),
    })

    await verifyCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    await waitFor(() => {
      expect(onAccountRequired).toHaveBeenCalledOnce()
    })
  })

  it('disables the control until the captcha verification completes', async () => {
    renderGuestTrialForm()

    const control = screen.getByRole('button', { name: 'Continuar sem conta' })
    expect(control).toBeDisabled()

    await verifyCaptcha()

    await waitFor(() => {
      expect(control).toBeEnabled()
    })
  })

  it('disables the control again while the captcha resets after a rejected submission', async () => {
    renderGuestTrialForm({
      startGuestTrial: respondWith({ status: 'captcha-required' }),
    })

    await verifyCaptcha()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    const control = await screen.findByRole('button', { name: 'Tentar novamente' })
    await waitFor(() => {
      expect(control).toBeDisabled()
    })
  })

  it('shows a small loading indicator next to the label while the captcha is pending', async () => {
    renderGuestTrialForm()

    const control = screen.getByRole('button', { name: 'Continuar sem conta' })
    expect(within(control).getByRole('status', { hidden: true })).toBeInTheDocument()

    await verifyCaptcha()

    await waitFor(() => {
      expect(within(control).queryByRole('status', { hidden: true })).not.toBeInTheDocument()
    })
  })

  describe('compact appearance', () => {
    it('renders a small ghost control', () => {
      renderGuestTrialForm({ appearance: 'compact' })

      const control = screen.getByRole('button', { name: 'Continuar sem conta' })

      expect(control).toHaveClass('min-h-8', 'bg-transparent', 'text-text-muted', 'px-2', 'text-sm')
    })

    it('still starts the trial directly from the compact control', async () => {
      const onStarted = vi.fn()

      renderGuestTrialForm({
        appearance: 'compact',
        onStarted,
        startGuestTrial: respondWith({ status: 'started' }),
      })

      await verifyCaptcha()
      fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

      await waitFor(() => {
        expect(onStarted).toHaveBeenCalledOnce()
      })
    })

    it('still raises a failure as a toast in the compact control', async () => {
      const { toast } = await import('sonner')

      renderGuestTrialForm({
        appearance: 'compact',
        startGuestTrial: respondWith({
          status: 'api-error',
          error: { code: 'shared.INTERNAL_ERROR', issues: null, requestId: null },
        }),
      })

      await verifyCaptcha()
      fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Não foi possível concluir a ação. Tente novamente.',
        )
      })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
