import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AlertDialogProvider } from '@/components/providers/alert-dialog-provider'
import type { TurnstileApi, TurnstileRenderOptions } from '@/components/ui/turnstile/types'
import { messages } from '@/i18n/messages'
import { initialAuthActionState, type StartGuestTrialAction } from '@/lib/auth/action-state'
import { dismissAlertDialog } from '@/lib/feedback/alert-dialog'

import { AuthenticationDialog, type AuthenticationMode } from './index'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const signInAction = () => Promise.resolve(initialAuthActionState)
const signUpAction = () => Promise.resolve(initialAuthActionState)

const widgets: { readonly container: HTMLElement; readonly options: TurnstileRenderOptions }[] = []

function installTurnstile(): void {
  const api: TurnstileApi = {
    render: (container, options) => {
      widgets.push({ container, options })

      return `widget-${String(widgets.length - 1)}`
    },
    remove: () => {},
    reset: () => {},
  }

  window.turnstile = api
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

function renderAuthenticationDialog() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <AuthenticationDialog
        mode="sign-in"
        onClose={() => undefined}
        onModeChange={() => undefined}
        signInAction={signInAction}
        signUpAction={signUpAction}
      />
    </NextIntlClientProvider>,
  )
}

function AuthenticationDialogHarness() {
  const [mode, setMode] = useState<AuthenticationMode>('sign-in')

  return (
    <AuthenticationDialog
      mode={mode}
      onClose={() => undefined}
      onModeChange={setMode}
      signInAction={signInAction}
      signUpAction={signUpAction}
    />
  )
}

function renderAuthenticationDialogHarness() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <AuthenticationDialogHarness />
    </NextIntlClientProvider>,
  )
}

describe('AuthenticationDialog', () => {
  afterEach(() => {
    act(() => {
      dismissAlertDialog()
    })
    cleanup()
  })

  it('uses a compact panel on mobile and a smaller clean hero split on desktop', () => {
    renderAuthenticationDialog()

    const dialog = screen.getByRole('dialog', { name: 'É bom ter você de volta.' })
    const content = screen.getByTestId('authentication-dialog-content')

    expect(dialog).toHaveClass(
      'lg:max-w-4xl',
      'lg:h-[min(40rem,calc(100dvh-4rem))]',
      'lg:grid',
      'lg:grid-cols-2',
      'p-0',
      'bg-surface',
    )
    expect(dialog).not.toHaveClass('border')
    expect(dialog).not.toHaveClass('border-border')
    expect(dialog).not.toHaveClass('border-divider')
    const showcase = screen.getByRole('region', { name: 'Imagem do Mindness' })

    expect(showcase).toContainElement(screen.getByRole('img', { name: 'Palestrante em um palco' }))
    expect(screen.getByTestId('authentication-showcase-brand')).toHaveClass(
      'absolute',
      'left-6',
      'top-6',
      'text-2xl',
      'font-normal',
    )
    expect(content).toHaveClass(
      'min-h-64',
      'border',
      'border-border',
      'rounded-2xl',
      'bg-surface',
      'lg:min-h-0',
      'lg:rounded-l-none',
    )
    expect(dialog).not.toHaveTextContent('Melhore sua comunicação enquanto fica mais inteligente.')
  })

  it('renders the requested sign-in content in vertical order', () => {
    renderAuthenticationDialog()

    const content = screen.getByTestId('authentication-dialog-content')
    const signInTab = screen.getByRole('tab', { name: 'Entrar' })
    const signUpTab = screen.getByRole('tab', { name: 'Criar conta' })
    const welcome = screen.getByRole('heading', { name: 'Boas-vindas ao Mindness.' })
    const welcomeDescription = screen.getByText('Entre com Google ou e-mail e senha')
    const googleEntry = screen.getByRole('link', { name: 'Entrar com Google' })
    const divider = screen.getByRole('separator')
    const email = screen.getByLabelText('E-mail')
    const password = screen.getByLabelText('Senha')
    const submit = screen.getByRole('button', { name: 'Login' })
    const continueWithoutAccount = screen.getByRole('button', {
      name: 'Continuar sem conta',
    })

    expect(content).toContainElement(signInTab)
    expect(screen.getByRole('tabpanel')).toHaveClass('content-start')
    expect(signInTab).toHaveAttribute('aria-selected', 'true')
    expect(signInTab).toHaveClass('min-h-8', 'bg-surface', 'text-text')
    expect(signInTab).not.toHaveClass('bg-white')
    expect(signInTab).not.toHaveClass('bg-text')
    expect(signUpTab).toHaveAttribute('aria-selected', 'false')
    expect(signUpTab).toHaveClass('min-h-8', 'bg-transparent', 'text-text-muted')
    expect(welcome).toHaveClass('font-(family-name:--font-buenard)', 'text-3xl', 'font-normal')
    expect(welcome.parentElement).toHaveClass('gap-2')
    expect(welcomeDescription).toHaveClass('text-sm', 'font-normal', 'text-text-muted')
    expect(
      welcome.compareDocumentPosition(welcomeDescription) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      welcomeDescription.compareDocumentPosition(googleEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(googleEntry).toHaveClass('min-h-14', 'text-base')
    expect(
      googleEntry.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(divider.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(email.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(password.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(submit).toHaveClass('min-h-14', 'text-base')
    expect(
      submit.compareDocumentPosition(continueWithoutAccount) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(continueWithoutAccount).toHaveClass('justify-self-end', 'text-sm')
  })

  it('switches to account creation with one password field and its requirements', () => {
    renderAuthenticationDialogHarness()

    fireEvent.click(screen.getByRole('tab', { name: 'Criar conta' }))

    expect(screen.getByRole('tab', { name: 'Criar conta' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Criar conta' })).toHaveClass(
      'min-h-8',
      'bg-surface',
      'text-text',
    )
    expect(screen.getByTestId('authentication-showcase-brand')).toHaveTextContent('Mindness')
    expect(screen.getByTestId('authentication-dialog-sign-up-welcome')).toHaveTextContent(
      'Crie sua conta',
    )
    expect(screen.getByTestId('authentication-dialog-sign-up-welcome')).toHaveClass(
      'font-(family-name:--font-buenard)',
      'text-3xl',
      'font-normal',
    )
    expect(screen.getByTestId('authentication-dialog-sign-up-welcome').parentElement).toHaveClass(
      'gap-2',
    )
    expect(screen.getByText('Use seu e-mail e senha')).toHaveClass(
      'text-sm',
      'font-normal',
      'text-text-muted',
    )
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.queryByLabelText('Confirme sua senha')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Requisitos da senha' })).toHaveTextContent(
      'Pelo menos 8 caracteres',
    )
    expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveClass('min-h-14', 'text-base')
    expect(screen.getByRole('button', { name: 'Continuar sem conta' })).toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).toHaveClass(
      'content-start',
      'lg:min-h-0',
      'lg:flex-1',
      'lg:overflow-y-auto',
    )
  })

  it('delegates continue-without-account to its own handler instead of closing the dialog', () => {
    const onClose = vi.fn()
    const onContinueWithoutAccount = vi.fn()

    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AuthenticationDialog
          mode="sign-in"
          onClose={onClose}
          onContinueWithoutAccount={onContinueWithoutAccount}
          onModeChange={() => undefined}
          signInAction={signInAction}
          signUpAction={signUpAction}
        />
      </NextIntlClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

    expect(onContinueWithoutAccount).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('raises the initial error carried from a redirect as a toast', async () => {
    const { toast } = await import('sonner')
    vi.mocked(toast.error).mockClear()

    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AuthenticationDialog
          initialError={{ messageKey: 'auth.errors.googleSignInFailed', presentation: 'toast' }}
          mode="sign-in"
          onClose={() => undefined}
          onModeChange={() => undefined}
          signInAction={signInAction}
          signUpAction={signUpAction}
        />
      </NextIntlClientProvider>,
    )

    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('raises the password-updated confirmation as a toast, not next to the sign-in form', async () => {
    const { toast } = await import('sonner')

    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AuthenticationDialog
          mode="sign-in"
          onClose={() => undefined}
          onModeChange={() => undefined}
          passwordUpdated
          signInAction={signInAction}
          signUpAction={signUpAction}
        />
      </NextIntlClientProvider>,
    )

    expect(toast.success).toHaveBeenCalledWith('Senha atualizada. Entre novamente para continuar.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('announces the sign-up confirmation as a dialog and leaves the form behind', async () => {
    const onClose = vi.fn()

    widgets.length = 0
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
    installTurnstile()
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AuthenticationDialog
          mode="sign-up"
          onClose={onClose}
          onModeChange={() => undefined}
          signInAction={signInAction}
          signUpAction={() => Promise.resolve({ status: 'success' })}
        />
        <AlertDialogProvider />
      </NextIntlClientProvider>,
    )

    await waitFor(() => {
      expect(widgets).not.toHaveLength(0)
    })
    await act(() => {
      widgets[0]?.options.callback('captcha-token')

      return Promise.resolve()
    })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Valid_password1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('dialog', { name: 'Tudo certo' })).toHaveAccessibleDescription(
      'Verifique seu e-mail para continuar.',
    )
    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.unstubAllEnvs()
    delete window.turnstile
  })

  describe('continuing without an account starts the guest trial directly', () => {
    beforeEach(() => {
      widgets.length = 0
      vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
      installTurnstile()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      delete window.turnstile
    })

    it('submits the guest trial from its own control instead of opening another dialog', async () => {
      const onGuestTrialStarted = vi.fn()
      const submitted: FormData[] = []
      const startGuestTrial: StartGuestTrialAction = (_state, formData) => {
        submitted.push(formData)

        return Promise.resolve({ status: 'started' })
      }

      render(
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <AuthenticationDialog
            mode="sign-in"
            onClose={() => undefined}
            onGuestTrialStarted={onGuestTrialStarted}
            onModeChange={() => undefined}
            signInAction={signInAction}
            signUpAction={signUpAction}
            startGuestTrial={startGuestTrial}
          />
        </NextIntlClientProvider>,
      )

      expect(screen.getByRole('button', { name: 'Continuar sem conta' })).toHaveClass(
        'min-h-8',
        'bg-transparent',
        'text-text-muted',
      )

      await verifyGuestTrialCaptcha()
      fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

      await waitFor(() => {
        expect(onGuestTrialStarted).toHaveBeenCalledOnce()
      })
      expect(submitted[0]?.get('captchaToken')).toBe('captcha-token')
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })

    it('asks for an account without opening another dialog when the trial was already used', async () => {
      const onGuestTrialAccountRequired = vi.fn()

      render(
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <AuthenticationDialog
            mode="sign-in"
            onClose={() => undefined}
            onGuestTrialAccountRequired={onGuestTrialAccountRequired}
            onModeChange={() => undefined}
            signInAction={signInAction}
            signUpAction={signUpAction}
            startGuestTrial={() => Promise.resolve({ status: 'account-required' })}
          />
        </NextIntlClientProvider>,
      )

      await verifyGuestTrialCaptcha()
      fireEvent.click(screen.getByRole('button', { name: 'Continuar sem conta' }))

      await waitFor(() => {
        expect(onGuestTrialAccountRequired).toHaveBeenCalledOnce()
      })
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })
  })
})
