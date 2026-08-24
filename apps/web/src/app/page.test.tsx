import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import HomePage from './page'

describe('HomePage', () => {
  afterEach(cleanup)

  it('renders the main heading', () => {
    render(<HomePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Mindness' })).toBeInTheDocument()
  })

  it('shows the temporary component showcase', () => {
    render(<HomePage />)

    expect(screen.getByRole('heading', { level: 2, name: 'Buttons' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Fields and select' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Surface and feedback' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Loading' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument()
    expect(screen.getAllByRole('status')).not.toHaveLength(0)
  })
})
