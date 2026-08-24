import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PasswordInput } from './index'

describe('PasswordInput', () => {
  it('toggles password visibility with an accessible Hugeicons control', () => {
    render(
      <PasswordInput
        aria-label="Password"
        hidePasswordLabel="Hide password"
        showPasswordLabel="Show password"
      />,
    )

    const input = screen.getByLabelText('Password')
    const toggle = screen.getByRole('button', { name: 'Show password' })

    expect(input).toHaveAttribute('type', 'password')
    expect(toggle.querySelector('i')).toHaveClass('hgi-view')

    fireEvent.click(toggle)

    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' }).querySelector('i')).toHaveClass(
      'hgi-view-off',
    )
  })
})
