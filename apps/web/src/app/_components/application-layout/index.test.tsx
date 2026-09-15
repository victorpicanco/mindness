import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccountProfile } from '@/lib/api/contracts/accounts'
import {
  getAccountProfileIfAuthenticated,
  getActiveSessionIfAuthenticated,
  getSessionHistory,
} from '@/lib/api/authenticated-session-data'

import { ApplicationLayout } from './index'

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}))
vi.mock('@/lib/api/authenticated-session-data', () => ({
  getAccountProfileIfAuthenticated: vi.fn(),
  getActiveSessionIfAuthenticated: vi.fn(),
  getSessionHistory: vi.fn(),
}))
vi.mock('@/app/_components/session-shell', () => ({
  AuthenticatedSessionShell: ({ children }: { readonly children: ReactNode }) => children,
}))

const REGISTERED_PROFILE: AccountProfile = {
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

describe('ApplicationLayout', () => {
  beforeEach(() => {
    vi.mocked(getAccountProfileIfAuthenticated).mockResolvedValue(REGISTERED_PROFILE)
    vi.mocked(getActiveSessionIfAuthenticated).mockResolvedValue(null)
    vi.mocked(getSessionHistory).mockResolvedValue({
      data: [],
      meta: { nextCursor: null, pageSize: 20, timeZone: 'America/Sao_Paulo' },
    })
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it('loads history without waiting for the independent active-session request', async () => {
    let resolveActiveSession = () => {}
    const activeSession = new Promise<null>((resolve) => {
      resolveActiveSession = () => resolve(null)
    })
    vi.mocked(getActiveSessionIfAuthenticated).mockReturnValue(activeSession)
    const layout = ApplicationLayout({ children: 'Practice', requireAuthentication: false })

    try {
      await vi.waitFor(() => expect(getSessionHistory).toHaveBeenCalledOnce(), { timeout: 100 })
    } finally {
      resolveActiveSession()
      render(await layout)
    }

    expect(screen.getByText('Practice')).toBeInTheDocument()
  })

  it('does not request private session data for a visitor', async () => {
    vi.mocked(getAccountProfileIfAuthenticated).mockResolvedValue(null)

    render(await ApplicationLayout({ children: 'Practice', requireAuthentication: false }))

    expect(getActiveSessionIfAuthenticated).not.toHaveBeenCalled()
    expect(getSessionHistory).not.toHaveBeenCalled()
    expect(screen.getByText('Practice')).toBeInTheDocument()
  })

  it('loads the active session but never history for a guest', async () => {
    vi.mocked(getAccountProfileIfAuthenticated).mockResolvedValue({
      ...REGISTERED_PROFILE,
      accountKind: 'guest',
      authenticationMethod: 'anonymous',
      email: null,
    })

    await ApplicationLayout({ children: 'Practice', requireAuthentication: false })

    expect(getActiveSessionIfAuthenticated).toHaveBeenCalledOnce()
    expect(getSessionHistory).not.toHaveBeenCalled()
  })
})
