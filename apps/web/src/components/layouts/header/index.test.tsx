import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Header } from './index'

describe('Header', () => {
  afterEach(cleanup)

  it('renders the left item inside a banner landmark hidden from desktop', () => {
    render(<Header leftItem={<button type="button">Menu</button>} />)

    const header = screen.getByRole('banner')

    expect(header).not.toHaveClass('md:hidden')
    expect(header).toContainElement(screen.getByRole('button', { name: 'Menu' }))
  })

  it('renders without a left item', () => {
    render(<Header />)

    expect(screen.getByRole('banner')).toBeEmptyDOMElement()
  })

  it('renders a right-aligned status item', () => {
    render(<Header rightItem={<output>Cota de sessões</output>} />)

    expect(screen.getByRole('banner')).toContainElement(screen.getByText('Cota de sessões'))
  })
})
