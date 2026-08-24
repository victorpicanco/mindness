import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from './index'

describe('Button', () => {
  afterEach(cleanup)

  it('renders a native button', () => {
    render(<Button>Continue</Button>)

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('cursor-pointer')
  })

  it('disables itself and reports busy while loading', () => {
    render(<Button isLoading>Continue</Button>)

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('aria-busy', 'true')
  })

  it.each([
    ['primary', 'bg-text'],
    ['secondary', 'border-border'],
    ['destructive', 'bg-error'],
  ] as const)('applies the static %s variant class', (variant, expectedClass) => {
    render(<Button variant={variant}>Continue</Button>)

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass(expectedClass)
  })

  it('gives the secondary variant a subtle hover motion', () => {
    render(<Button variant="secondary">Continue</Button>)

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass(
      'hover:-translate-y-px',
      'hover:shadow-sm',
    )
  })
})
