import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Spinner } from './index'

describe('Spinner', () => {
  it('exposes an accessible status message', () => {
    render(<Spinner />)

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.getByText('Loading')).toHaveClass('sr-only')
  })
})
