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
  it.each([true, false])('preserves guest choices when expanded is %s', (isExpanded) => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(onSelectAuthentication.mock.calls).toEqual([['sign-up'], ['sign-in']])
    expect(capture.mock.calls).toEqual([
      ['guest_account_sign_up_started'],
      ['guest_account_sign_in_started'],
    ])
  })

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
