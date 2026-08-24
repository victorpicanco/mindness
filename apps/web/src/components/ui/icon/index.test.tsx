import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Icon } from './index'

describe('Icon', () => {
  afterEach(cleanup)

  it('renders a decorative hugeicons glyph for the given name', () => {
    const { container } = render(<Icon name="chart-increase" />)

    expect(container.firstElementChild).toHaveClass('hgi-stroke', 'hgi-chart-increase', 'text-xl')
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('replaces the default size with the given class name', () => {
    const { container } = render(<Icon className="text-3xl" name="cancel-01" />)

    expect(container.firstElementChild).toHaveClass('hgi-stroke', 'hgi-cancel-01', 'text-3xl')
    expect(container.firstElementChild).not.toHaveClass('text-xl')
  })
})
