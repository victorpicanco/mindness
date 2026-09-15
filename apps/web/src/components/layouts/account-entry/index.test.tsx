import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountEntry, VisitorTopBarAccountEntry } from './index'

const LABELS = {
  description: 'Keep your practice history',
  label: 'Account access',
  signIn: 'Sign in',
  signUp: 'Create account',
  title: 'Keep practicing',
}

afterEach(cleanup)

describe('AccountEntry', () => {
  it.each([true, false])('offers only sign-in to visitors when expanded is %s', (isExpanded) => {
    const capture = vi.fn()
    const onSelectAuthentication = vi.fn()

    render(
      <AccountEntry
        analytics={{ capture, getDistinctId: () => '', reset: () => undefined }}
        fromGuest={false}
        isExpanded={isExpanded}
        labels={LABELS}
        onSelectAuthentication={onSelectAuthentication}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument()
    expect(onSelectAuthentication).toHaveBeenCalledExactlyOnceWith('sign-in')
    expect(capture).not.toHaveBeenCalled()
  })

  it.each([true, false])(
    'keeps the guest entry identical to the visitor one, only tracking sign-in when expanded is %s',
    (isExpanded) => {
      const capture = vi.fn()
      const onSelectAuthentication = vi.fn()

      render(
        <AccountEntry
          analytics={{ capture, getDistinctId: () => '', reset: () => undefined }}
          fromGuest
          isExpanded={isExpanded}
          labels={LABELS}
          onSelectAuthentication={onSelectAuthentication}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

      expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument()
      expect(onSelectAuthentication).toHaveBeenCalledExactlyOnceWith('sign-in')
      expect(capture).toHaveBeenCalledExactlyOnceWith('guest_account_sign_in_started')
    },
  )

  it('preserves both visitor choices in the top bar', () => {
    const onSelectAuthentication = vi.fn()

    render(
      <VisitorTopBarAccountEntry labels={LABELS} onSelectAuthentication={onSelectAuthentication} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(onSelectAuthentication.mock.calls).toEqual([['sign-in'], ['sign-up']])
  })
})
