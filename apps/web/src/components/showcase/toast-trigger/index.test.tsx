import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

import { ToastTrigger } from './index'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

describe('ToastTrigger', () => {
  it('shows each toast variant when its trigger is clicked', async () => {
    const { toast } = await import('sonner')

    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <ToastTrigger />
      </NextIntlClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Informativo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sucesso' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aviso' }))
    fireEvent.click(screen.getByRole('button', { name: 'Erro' }))

    expect(toast.info).toHaveBeenCalledWith('Este é um toast informativo.')
    expect(toast.success).toHaveBeenCalledWith('Ação concluída com sucesso.')
    expect(toast.warning).toHaveBeenCalledWith('Atenção: revise esta informação.')
    expect(toast.error).toHaveBeenCalledWith('Não foi possível concluir a ação.')
  })
})
