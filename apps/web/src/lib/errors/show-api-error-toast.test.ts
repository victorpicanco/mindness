import { afterEach, describe, expect, it, vi } from 'vitest'

import { showApiErrorToast, type ApiErrorTranslator } from './show-api-error-toast'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

afterEach(() => {
  vi.clearAllMocks()
})

function fakeTranslator(known: Record<string, string>): ApiErrorTranslator {
  return (key) => known[key] ?? ''
}

describe('showApiErrorToast', () => {
  it('shows the translated message for a known error code', async () => {
    const { toast } = await import('sonner')
    const t = fakeTranslator({
      'auth.errors.sessionExpired': 'Sua sessão expirou. Entre novamente.',
    })

    showApiErrorToast(
      { code: 'web.AUTHENTICATION_EXPIRED', issues: null, requestId: 'request-id' },
      t,
    )

    expect(toast.error).toHaveBeenCalledWith('Sua sessão expirou. Entre novamente.', {
      id: 'request-id',
    })
  })

  it('falls back to the generic message for an unmapped error code', async () => {
    const { toast } = await import('sonner')
    const t = fakeTranslator({
      'common.errors.unknown': 'Não foi possível concluir a ação. Tente novamente.',
    })

    showApiErrorToast({ code: 'accounts.SOME_NEW_ERROR', issues: null, requestId: null }, t)

    expect(toast.error).toHaveBeenCalledWith('Não foi possível concluir a ação. Tente novamente.')
  })

  it('does not show a toast for an inline error', async () => {
    const { toast } = await import('sonner')
    const t = fakeTranslator({
      'auth.errors.authenticationRejected': 'E-mail ou senha incorretos.',
    })

    showApiErrorToast(
      { code: 'accounts.AUTHENTICATION_REJECTED', issues: null, requestId: 'request-id' },
      t,
    )

    expect(toast.error).not.toHaveBeenCalled()
  })
})
