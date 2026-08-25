import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PasswordInput } from './index'

describe('PasswordInput', () => {
  it('toggles password visibility with an accessible icon control', () => {
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
    expect(toggle.querySelector('[data-icon="view"]')).toBeInTheDocument()

    fireEvent.click(toggle)

    expect(input).toHaveAttribute('type', 'text')
    expect(
      screen.getByRole('button', { name: 'Hide password' }).querySelector('[data-icon="view-off"]'),
    ).toBeInTheDocument()
  })
})
