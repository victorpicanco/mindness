import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Field } from '../field'
import { Select } from './index'

describe('Select', () => {
  afterEach(cleanup)

  it('renders options, reports selection changes, and works with Field', () => {
    let selectedValue = ''

    const { container } = render(
      <Field label="Category">
        <Select
          onChange={(event) => {
            selectedValue = event.target.value
          }}
        >
          <option value="focus">Focus</option>
          <option value="confidence">Confidence</option>
        </Select>
      </Field>,
    )

    const select = screen.getByLabelText('Category')
    fireEvent.change(select, { target: { value: 'confidence' } })

    expect(screen.getByRole('option', { name: 'Focus' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Confidence' })).toBeInTheDocument()
    expect(selectedValue).toBe('confidence')
    expect(select).toHaveClass('rounded-full', 'border-transparent', 'bg-input', 'px-6')
    expect(container.querySelector('svg')).toHaveClass(
      'pointer-events-none',
      'size-4',
      'text-text-muted',
    )
  })
})
