import { describe, expect, it, vi } from 'vitest'

import { createPostHogClient } from './posthog-server'

describe('createPostHogClient', () => {
  it('returns a client that does nothing when the project token is not configured', async () => {
    const client = createPostHogClient({ env: { NODE_ENV: 'production' } })

    expect(() => client.capture({ event: 'session_started' })).not.toThrow()
    expect(() => client.identify({ distinctId: 'person@example.com' })).not.toThrow()
    await expect(client.flush()).resolves.toBeUndefined()
  })

  it('warns in development when the project token is missing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    createPostHogClient({ env: { NODE_ENV: 'development' } })

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'),
    )
    consoleError.mockRestore()
  })

  it('does not warn outside development when the project token is missing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    createPostHogClient({ env: { NODE_ENV: 'production' } })

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('does not warn in development once the project token is configured', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    createPostHogClient({
      env: { NODE_ENV: 'development', NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test' },
      createClient: () => ({
        capture: () => undefined,
        identify: () => undefined,
        flush: () => Promise.resolve(),
      }),
    })

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('builds the real client with the configured project token and host', () => {
    const createClient = vi.fn().mockReturnValue({
      capture: () => undefined,
      identify: () => undefined,
      flush: () => Promise.resolve(),
    })

    createPostHogClient({
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test',
        NEXT_PUBLIC_POSTHOG_HOST: 'https://posthog.test',
      },
      createClient,
    })

    expect(createClient).toHaveBeenCalledWith('phc_test', 'https://posthog.test')
  })

  it('omits the host from the real client when it is not configured', () => {
    const createClient = vi.fn().mockReturnValue({
      capture: () => undefined,
      identify: () => undefined,
      flush: () => Promise.resolve(),
    })

    createPostHogClient({
      env: { NODE_ENV: 'production', NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test' },
      createClient,
    })

    expect(createClient).toHaveBeenCalledWith('phc_test', undefined)
  })

  it('treats a blank project token the same as an absent one', async () => {
    const createClient = vi.fn()

    const client = createPostHogClient({
      env: { NODE_ENV: 'production', NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: '' },
      createClient,
    })

    expect(createClient).not.toHaveBeenCalled()
    await expect(client.flush()).resolves.toBeUndefined()
  })

  it('treats a blank host the same as an absent one', () => {
    const createClient = vi.fn().mockReturnValue({
      capture: () => undefined,
      identify: () => undefined,
      flush: () => Promise.resolve(),
    })

    createPostHogClient({
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test',
        NEXT_PUBLIC_POSTHOG_HOST: '',
      },
      createClient,
    })

    expect(createClient).toHaveBeenCalledWith('phc_test', undefined)
  })
})
