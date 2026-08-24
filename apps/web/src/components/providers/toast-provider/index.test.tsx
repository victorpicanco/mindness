import { act, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { toast } from 'sonner'
import { describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'

import { ThemeProvider } from '@/components/providers/theme-provider'

import { ToastProvider } from './index'

describe('ToastProvider', () => {
  it('renders styled notifications at the top-right using the application theme', async () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <ThemeProvider>
          <ToastProvider />
        </ThemeProvider>
      </NextIntlClientProvider>,
    )

    act(() => {
      toast.info('Toast message')
    })

    const toaster = (await screen.findByText('Toast message')).closest('[data-sonner-toaster]')

    expect(toaster).toHaveAttribute('data-x-position', 'right')
    expect(toaster).toHaveAttribute('data-y-position', 'top')
    expect(toaster).toHaveAttribute('data-sonner-theme', 'light')
    expect(screen.getByText('Toast message').closest('[data-sonner-toast]')).toHaveAttribute(
      'data-rich-colors',
      'true',
    )
    expect(screen.getByText('Toast message').closest('[data-sonner-toast]')).toHaveClass(
      'mindness-toast',
    )
  })
})
