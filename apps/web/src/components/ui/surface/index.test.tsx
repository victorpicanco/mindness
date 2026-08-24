import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Surface } from './index'

describe('Surface', () => {
  afterEach(cleanup)

  it('renders its children with semantic surface tokens', () => {
    render(<Surface>Practice details</Surface>)

    expect(screen.getByText('Practice details')).toHaveClass(
      'bg-surface-raised',
      'border-border',
      'rounded-control',
    )
  })
})
