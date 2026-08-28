import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ShinyText } from './index'

describe('ShinyText', () => {
  afterEach(cleanup)

  it('renders the given text with the shine animation applied', () => {
    render(<ShinyText text="Analisando" />)

    expect(screen.getByText('Analisando')).toHaveClass('mindness-shiny-text')
  })

  it('keeps the caller classes alongside the animation', () => {
    render(<ShinyText className="text-sm" text="Analisando" />)

    expect(screen.getByText('Analisando')).toHaveClass('mindness-shiny-text', 'text-sm')
  })
})
