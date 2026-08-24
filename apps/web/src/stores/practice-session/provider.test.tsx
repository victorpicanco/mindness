import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PracticeSessionProvider, usePracticeSessionStore } from './provider'

function SessionStatus() {
  const status = usePracticeSessionStore((state) => state.status)

  return <p>{status}</p>
}

describe('PracticeSessionProvider', () => {
  afterEach(cleanup)

  it('initializes the store from the active session received from the server', () => {
    render(
      <PracticeSessionProvider
        initialState={{
          session: {
            expiresAt: '2026-08-24T12:05:00.000Z',
            sessionId: 'session-1',
            themeTitle: 'Communicating with clarity',
          },
          status: 'researching',
        }}
      >
        <SessionStatus />
      </PracticeSessionProvider>,
    )

    expect(screen.getByText('researching')).toBeInTheDocument()
  })
})
