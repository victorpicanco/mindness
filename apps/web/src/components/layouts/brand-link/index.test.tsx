import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BrandLink } from './index'

describe('BrandLink', () => {
  afterEach(cleanup)

  it('links the product logo back to the home page', () => {
    render(<BrandLink label="Página inicial do Mindness" logoAlt="Mindness" />)

    const link = screen.getByRole('link', { name: 'Página inicial do Mindness' })

    expect(link).toHaveAttribute('href', '/')
    expect(within(link).getByAltText('Mindness')).toBeInTheDocument()
  })

  it('appends the given class name and reports the navigation', () => {
    const onClick = vi.fn()

    render(
      <BrandLink
        className="relative z-10"
        label="Página inicial do Mindness"
        logoAlt="Mindness"
        onClick={onClick}
      />,
    )

    const link = screen.getByRole('link', { name: 'Página inicial do Mindness' })
    fireEvent.click(link)

    expect(link).toHaveClass('grid', 'size-10', 'relative', 'z-10')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders the icon logo by default', () => {
    render(<BrandLink label="Página inicial do Mindness" logoAlt="Mindness" />)

    const link = screen.getByRole('link', { name: 'Página inicial do Mindness' })

    expect(within(link).getByAltText('Mindness')).toBeInTheDocument()
    expect(screen.queryByText('Mindness')).not.toBeInTheDocument()
  })

  it('renders the wordmark instead of the icon when expanded', () => {
    render(<BrandLink isExpanded label="Página inicial do Mindness" logoAlt="Mindness" />)

    const link = screen.getByRole('link', { name: 'Página inicial do Mindness' })

    expect(within(link).queryByAltText('Mindness')).not.toBeInTheDocument()
    expect(within(link).getByText('Mindness')).toHaveClass('font-(family-name:--font-buenard)')
  })
})
