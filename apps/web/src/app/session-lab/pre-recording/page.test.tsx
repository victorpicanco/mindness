import { cleanup, render, screen } from '@testing-library/react'
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'

import PreRecordingLabPage from './page'

function renderPreRecordingLabPage() {
  return render(
    <PathnameContext.Provider value="/session-lab/pre-recording">
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <PreRecordingLabPage />
      </NextIntlClientProvider>
    </PathnameContext.Provider>,
  )
}

describe('PreRecordingLabPage', () => {
  afterEach(cleanup)

  it('renders the pre-recording screen without any session wiring', () => {
    renderPreRecordingLabPage()

    expect(
      screen.getByRole('heading', { name: 'Comunicação clara em conversas difíceis' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descartar gravação' })).not.toBeInTheDocument()
  })

  it('frames the screen with the authenticated shell', () => {
    renderPreRecordingLabPage()

    expect(
      screen.getByRole('complementary', { name: 'Navegação do aplicativo' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Cota de sessões')).toHaveTextContent('3/4 sessões restantes')
  })
})
