import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Providers } from './providers'

describe('Providers', () => {
  afterEach(cleanup)

  it('renders children inside the application providers', () => {
    expect(() =>
      render(
        <Providers>
          <p>Provider child</p>
        </Providers>,
      ),
    ).not.toThrow()

    expect(screen.getByText('Provider child')).toBeInTheDocument()
  })
})
