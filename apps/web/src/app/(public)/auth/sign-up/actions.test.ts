import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSignUpAction } from './sign-up-action-factory'
import { initialAuthActionState } from '@/lib/auth/action-state'

class InMemoryCookieStore {
  get(): undefined {
    return undefined
  }

  set(): void {}

  delete(): void {}
}

function createFormData(values: Record<string, string>): FormData {
  const formData = new FormData()

  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value)
  }

  return formData
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('signUpAction', () => {
  it('validates the email and password before calling the API', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const signUpAction = createSignUpAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: { message: 'unexpected' } }))
      },
    })

    const result = await signUpAction(
      initialAuthActionState,
      createFormData({ email: 'invalid', password: 'short', captchaToken: 'captcha-token' }),
    )

    expect(result).toEqual({
      status: 'validation-error',
      messageKey: 'errors.invalidEmail',
    })
    expect(requests).toEqual([])
  })

  it('requires a captcha token before calling the API', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const signUpAction = createSignUpAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: {} }))
      },
    })

    const result = await signUpAction(
      initialAuthActionState,
      createFormData({
        email: 'person@example.com',
        password: 'Valid_password1!',
        captchaToken: '',
      }),
    )

    expect(result).toEqual({
      status: 'validation-error',
      messageKey: 'errors.captchaRequired',
    })
    expect(requests).toEqual([])
  })

  it('rejects passwords that do not meet the required character sets before calling the API', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const signUpAction = createSignUpAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: { message: 'unexpected' } }))
      },
    })

    const result = await signUpAction(
      initialAuthActionState,
      createFormData({
        email: 'person@example.com',
        password: 'valid-password',
        captchaToken: 'captcha-token',
      }),
    )

    expect(result).toEqual({
      status: 'validation-error',
      messageKey: 'errors.invalidPassword',
    })
    expect(requests).toEqual([])
  })

  it('returns the email confirmation state without writing a session', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const signUpAction = createSignUpAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: () =>
        Promise.resolve(
          Response.json({
            data: {
              message:
                'Verifique seu e-mail para continuar, caso exista uma conta elegível para este endereço.',
            },
          }),
        ),
    })

    const result = await signUpAction(
      initialAuthActionState,
      createFormData({
        email: 'person@example.com',
        password: 'Valid_password1!',
        captchaToken: 'captcha-token',
      }),
    )

    expect(result).toEqual({ status: 'success' })
  })

  it('turns backend account creation rejections into an actionable state', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const signUpAction = createSignUpAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: () =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'accounts.ACCOUNT_CREATION_REJECTED',
                message: 'Account creation was rejected.',
                issues: null,
                requestId: 'request-id',
              },
            },
            { status: 409 },
          ),
        ),
    })

    const result = await signUpAction(
      initialAuthActionState,
      createFormData({
        email: 'person@example.com',
        password: 'Valid_password1!',
        captchaToken: 'captcha-token',
      }),
    )

    expect(result).toEqual({
      status: 'api-error',
      error: {
        code: 'accounts.ACCOUNT_CREATION_REJECTED',
        issues: null,
        requestId: 'request-id',
      },
    })
  })
})
