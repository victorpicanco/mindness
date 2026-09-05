import { describe, expect, it } from 'vitest'

import { ApiClientError } from '@/lib/api/client-error'
import { updateAccountName } from '@/lib/api/update-account-name'

interface RecordedCall {
  readonly body: unknown
  readonly method: string
  readonly url: string
}

function fakeFetch(response: Response): { calls: RecordedCall[]; fetcher: typeof fetch } {
  const calls: RecordedCall[] = []

  const fetcher: typeof fetch = (input, init) => {
    const { method, url } = new Request(input, init)

    calls.push({ body: init?.body ?? null, method, url })

    return Promise.resolve(response)
  }

  return { calls, fetcher }
}

describe('updateAccountName', () => {
  it('sends the name to the account name endpoint and returns the stored one', async () => {
    const { calls, fetcher } = fakeFetch(Response.json({ data: { name: 'Maria Silva' } }))

    await expect(updateAccountName({ fetcher, name: 'Maria Silva' })).resolves.toBe('Maria Silva')

    expect(calls).toEqual([
      {
        body: JSON.stringify({ name: 'Maria Silva' }),
        method: 'PATCH',
        url: 'http://localhost:3000/api/bff/accounts/me/name',
      },
    ])
  })

  it('surfaces the API error envelope', async () => {
    const { fetcher } = fakeFetch(
      Response.json(
        {
          error: {
            code: 'accounts.INVALID_ACCOUNT_VALUE',
            issues: null,
            message: 'Account value is invalid',
            requestId: 'request-1',
          },
        },
        { status: 422 },
      ),
    )

    await expect(updateAccountName({ fetcher, name: 'Maria Silva' })).rejects.toBeInstanceOf(
      ApiClientError,
    )
  })
})
