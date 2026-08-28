import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SplitText } from './index'

describe('SplitText', () => {
  afterEach(cleanup)

  it('keeps the complete accessible text while preparing a word reveal', () => {
    render(<SplitText text="Uma resposta suave" />)

    expect(screen.getByText('Uma resposta suave')).toHaveAttribute('data-split-text', 'words')
  })

  it('renders the requested semantic element', () => {
    render(<SplitText tag="h2" text="Sua análise" />)

    expect(screen.getByRole('heading', { name: 'Sua análise' })).toHaveAttribute(
      'data-split-text',
      'words',
    )
  })
})
