import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Field } from './index'
import { Input } from '../input'

describe('Field', () => {
  afterEach(cleanup)

  it('associates its label and description with the input', () => {
    render(
      <Field description="Use the address tied to your account" label="Email">
        <Input />
      </Field>,
    )

    const input = screen.getByLabelText('Email')

    expect(input).toHaveAttribute('aria-describedby')
    expect(screen.getByText('Use the address tied to your account')).toHaveAttribute(
      'id',
      input.getAttribute('aria-describedby'),
    )
  })

  it('wires a control nested below its direct child', () => {
    render(
      <Field error="Enter a valid email address" label="Email">
        <div>
          <Input />
        </div>
      </Field>,
    )

    const input = screen.getByLabelText('Email')

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  })

  it('marks the input invalid and exposes its error', () => {
    render(
      <Field error="Enter a valid email address" label="Email">
        <Input />
      </Field>,
    )

    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address')
  })
})
