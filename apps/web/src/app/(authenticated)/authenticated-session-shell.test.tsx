import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/components/providers/theme-provider'
import { messages } from '@/i18n/messages'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { AuthenticatedSessionShellView } from './authenticated-session-shell'

const SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'

function PracticeSessionStatus() {
  const status = usePracticeSessionStore((state) => state.status)

  return <span>{status}</span>
}

describe('AuthenticatedSessionShell', () => {
  afterEach(cleanup)

  it('resets the practice session store after abandoning the active session', async () => {
    const abandonSession = vi.fn(() => Promise.resolve())
    const router = {
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      push: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    }

    render(
      <AppRouterContext.Provider value={router}>
        <PathnameContext.Provider value={`/sessions/${SESSION_ID}`}>
          <NextIntlClientProvider locale="pt-BR" messages={messages}>
            <ThemeProvider>
              <AuthenticatedSessionShellView
                accountProfile={{
                  accountId: '4ff569a3-bffc-4b5d-bbb2-662ebf994a85',
                  authenticationMethod: 'password',
                  consent: null,
                  createdAt: '2026-08-01T10:30:00.000Z',
                  email: 'person@example.com',
                  name: null,
                  plan: 'free',
                  timeZone: 'America/Sao_Paulo',
                }}
                abandonSession={abandonSession}
                activeSessionId={SESSION_ID}
                deleteSession={() => Promise.resolve()}
                initialIsExpanded
                initialPracticeSessionState={{
                  serverTimeOffsetMs: 0,
                  session: {
                    configuration: {
                      categorySlug: 'news',
                      difficulty: 'balanced',
                      searchWindowMinutes: 3,
                    } as const,
                    createdAt: '2026-08-25T12:00:00.000Z',
                    expiresAt: '2026-08-25T12:20:00.000Z',
                    recordingStartedAt: null,
                    researchEndsAt: '2026-08-25T12:03:00.000Z',
                    sessionId: SESSION_ID,
                    themeTitle: 'Notícias do dia',
                  },
                  status: 'researching',
                }}
                preferenceCookieName="mindness-sidebar-expanded"
                signOut={() => undefined}
              >
                <PracticeSessionStatus />
              </AuthenticatedSessionShellView>
            </ThemeProvider>
          </NextIntlClientProvider>
        </PathnameContext.Provider>
      </AppRouterContext.Provider>,
    )

    expect(screen.getByText('researching')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Nova sessão' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abandonar e começar outra' }))

    await vi.waitFor(() => expect(screen.getByText('idle')).toBeInTheDocument())
  })
})
