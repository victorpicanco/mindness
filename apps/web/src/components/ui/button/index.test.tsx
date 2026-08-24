import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from './index'
import { messages } from '@/i18n/messages'

function renderButton(element: ReactElement) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      {element}
    </NextIntlClientProvider>,
  )
}

describe('Button', () => {
  afterEach(cleanup)

  it('renders a native button', () => {
    renderButton(<Button>Continue</Button>)

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('cursor-pointer')
  })

  it('disables itself and reports busy while loading', () => {
    renderButton(<Button isLoading>Continue</Button>)

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('aria-busy', 'true')
  })

  it.each([
    ['primary', 'bg-text'],
    ['secondary', 'border-border'],
    ['destructive', 'bg-error'],
  ] as const)('applies the static %s variant class', (variant, expectedClass) => {
    renderButton(<Button variant={variant}>Continue</Button>)

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass(expectedClass)
  })

  it('gives the secondary variant a subtle hover motion', () => {
    renderButton(<Button variant="secondary">Continue</Button>)

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass(
      'hover:-translate-y-px',
      'hover:shadow-sm',
    )
  })
})
