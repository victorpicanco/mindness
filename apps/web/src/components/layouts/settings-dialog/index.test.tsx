import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

import { SettingsDialog } from './index'

interface RenderOptions {
  readonly name?: string | null
  readonly onClose?: () => void
  readonly onSaveName?: (name: string) => Promise<void>
  readonly onThemeChange?: (theme: 'dark' | 'light') => void
}

function renderSettingsDialog({
  name = null,
  onClose = () => undefined,
  onSaveName = () => Promise.resolve(),
  onThemeChange = () => undefined,
}: RenderOptions = {}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SettingsDialog
        accountLabels={{
          authenticationMethod: 'Método de acesso',
          authenticationMethodGoogle: 'Google',
          authenticationMethodPassword: 'E-mail e senha',
          consent: 'Consentimento de voz',
          consentAccepted: 'Aceito',
          consentAcceptedAt: 'Aceito em',
          consentNotRecorded: 'Não registrado',
          consentPurpose: 'Finalidade',
          consentPurposeVoice: 'Gravação de voz e análise',
          consentVersion: 'Versão',
          createdAt: 'Membro desde',
          email: 'E-mail',
          plan: 'Plano',
          planFree: 'Gratuito',
          timeZone: 'Fuso horário',
        }}
        accountLabel="Conta"
        accountProfile={{
          accountId: '4ff569a3-bffc-4b5d-bbb2-662ebf994a85',
          authenticationMethod: 'password',
          consent: {
            acceptedAt: '2026-08-15T12:00:00.000Z',
            purpose: 'voice_recording_and_analysis',
            version: '2026-08-15',
          },
          createdAt: '2026-08-01T10:30:00.000Z',
          email: 'person@example.com',
          name,
          plan: 'free',
          timeZone: 'America/Sao_Paulo',
        }}
        closeLabel="Fechar configurações"
        generalLabel="Geral"
        formatDateTime={(value) => `formatted:${value}`}
        onClose={onClose}
        onSaveName={onSaveName}
        onThemeChange={onThemeChange}
        open
        privacyLabel="Política de Privacidade"
        profileLabel="Perfil"
        profileLabels={{
          name: 'Nome',
          nameDescription: 'Até 40 caracteres.',
          namePlaceholder: 'Como devemos te chamar?',
          save: 'Salvar',
        }}
        theme="light"
        themeLabel="Tema"
        themeOptions={{ dark: 'Dark', light: 'Light' }}
        termsLabel="Termos de Uso"
        title="Configurações"
        updatedAtLabel="Atualizado em 5 de setembro de 2026"
      />
    </NextIntlClientProvider>,
  )
}

describe('SettingsDialog', () => {
  afterEach(cleanup)

  it('presents the general section in a responsive settings navigation', () => {
    renderSettingsDialog()

    const dialog = screen.getByRole('dialog', { name: 'Configurações' })
    const navigation = within(dialog).getByRole('navigation', { name: 'Configurações' })
    const generalItem = within(navigation).getByRole('button', { name: 'Geral' })

    expect(dialog).toBeInstanceOf(HTMLDialogElement)
    expect(dialog).toHaveClass('backdrop:bg-black/30', 'dark:backdrop:bg-black/60')
    expect(dialog).not.toHaveClass('backdrop:bg-text/30')
    expect(navigation).toHaveClass('overflow-x-auto', 'md:flex-col', 'md:overflow-x-visible')
    expect(generalItem).toHaveAttribute('aria-current', 'page')
    expect(generalItem.querySelector('[data-icon="settings-01"]')).toBeInTheDocument()
  })

  it('selects and persists the light or dark theme', () => {
    const onThemeChange = vi.fn()
    renderSettingsDialog({ onThemeChange })

    const themeSelector = screen.getByRole('combobox', { name: 'Tema' })

    expect(themeSelector).toHaveValue('light')
    expect(screen.getByRole('option', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Dark' })).toBeInTheDocument()

    fireEvent.change(themeSelector, { target: { value: 'dark' } })

    expect(onThemeChange).toHaveBeenCalledWith('dark')
  })

  it('shows account details without a profile summary or account identifier', () => {
    renderSettingsDialog()

    const dialog = screen.getByRole('dialog', { name: 'Configurações' })
    const navigation = within(dialog).getByRole('navigation', { name: 'Configurações' })
    const accountItem = within(navigation).getByRole('button', { name: 'Conta' })

    expect(accountItem.querySelector('[data-icon="user-01"]')).toBeInTheDocument()

    fireEvent.click(accountItem)

    expect(accountItem).toHaveAttribute('aria-current', 'page')
    expect(within(navigation).getByRole('button', { name: 'Geral' })).not.toHaveAttribute(
      'aria-current',
    )
    const accountPanel = within(dialog).getByRole('region', { name: 'Conta' })

    expect(within(accountPanel).getByRole('heading', { name: 'Conta' })).toBeInTheDocument()
    expect(within(accountPanel).getAllByText('person@example.com')).toHaveLength(1)
    expect(within(accountPanel).getAllByText('Gratuito')).toHaveLength(1)
    expect(within(accountPanel).getByText('America/Sao_Paulo')).toBeInTheDocument()
    expect(within(accountPanel).getByText('E-mail e senha')).toBeInTheDocument()
    expect(
      within(accountPanel).queryByText('4ff569a3-bffc-4b5d-bbb2-662ebf994a85'),
    ).not.toBeInTheDocument()
    expect(within(accountPanel).getByText('formatted:2026-08-01T10:30:00.000Z')).toBeInTheDocument()
    expect(within(accountPanel).getByText('Aceito')).toBeInTheDocument()
    expect(within(accountPanel).getByText('Gravação de voz e análise')).toBeInTheDocument()
    expect(within(accountPanel).getByText('2026-08-15')).toBeInTheDocument()
    expect(within(accountPanel).getByText('formatted:2026-08-15T12:00:00.000Z')).toBeInTheDocument()
    expect(within(dialog).queryByRole('combobox', { name: 'Tema' })).not.toBeInTheDocument()
  })

  it('offers profile and legal sections after the account one', () => {
    renderSettingsDialog()

    const dialog = screen.getByRole('dialog', { name: 'Configurações' })
    const navigation = within(dialog).getByRole('navigation', { name: 'Configurações' })
    const items = within(navigation).getAllByRole('button')

    expect(items.map((item) => item.textContent)).toEqual([
      'Geral',
      'Conta',
      'Perfil',
      'Política de Privacidade',
      'Termos de Uso',
    ])
    expect(items.at(2)?.querySelector('[data-icon="user-circle"]')).toBeInTheDocument()
  })

  it('shows the same privacy policy and terms available before authentication', () => {
    renderSettingsDialog()

    const dialog = screen.getByRole('dialog', { name: 'Configurações' })
    const navigation = within(dialog).getByRole('navigation', { name: 'Configurações' })
    const privacyItem = within(navigation).getByRole('button', {
      name: 'Política de Privacidade',
    })

    fireEvent.click(privacyItem)

    expect(privacyItem).toHaveAttribute('aria-current', 'page')
    expect(
      within(dialog).getByRole('region', { name: 'Política de Privacidade' }),
    ).toHaveTextContent('Supabase')

    const termsItem = within(navigation).getByRole('button', { name: 'Termos de Uso' })
    fireEvent.click(termsItem)

    expect(termsItem).toHaveAttribute('aria-current', 'page')
    expect(within(dialog).getByRole('region', { name: 'Termos de Uso' })).toHaveTextContent(
      'prática de comunicação',
    )
  })

  it('offers an empty name field limited to the accepted length', () => {
    renderSettingsDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }))

    const profilePanel = screen.getByRole('region', { name: 'Perfil' })
    const nameField = within(profilePanel).getByRole('textbox', { name: 'Nome' })

    expect(within(profilePanel).getByRole('heading', { name: 'Perfil' })).toBeInTheDocument()
    expect(nameField).toHaveValue('')
    expect(nameField).toHaveAttribute('maxLength', '40')
    expect(within(profilePanel).getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('shows the stored name and only saves a changed one, without its whitespace', async () => {
    const onSaveName = vi.fn(() => Promise.resolve())
    renderSettingsDialog({ name: 'Maria Silva', onSaveName })

    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }))

    const profilePanel = screen.getByRole('region', { name: 'Perfil' })
    const nameField = within(profilePanel).getByRole('textbox', { name: 'Nome' })
    const saveButton = within(profilePanel).getByRole('button', { name: 'Salvar' })

    expect(nameField).toHaveValue('Maria Silva')
    expect(saveButton).toBeDisabled()

    fireEvent.change(nameField, { target: { value: '  Maria Souza  ' } })
    expect(saveButton).toBeEnabled()

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(onSaveName).toHaveBeenCalledWith('Maria Souza')
    })
  })

  it('keeps the save control out of reach while the name is only whitespace', () => {
    renderSettingsDialog({ name: 'Maria Silva' })

    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }))

    const profilePanel = screen.getByRole('region', { name: 'Perfil' })

    fireEvent.change(within(profilePanel).getByRole('textbox', { name: 'Nome' }), {
      target: { value: '   ' },
    })

    expect(within(profilePanel).getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('closes from its close control and Escape', () => {
    const onClose = vi.fn()

    renderSettingsDialog({ onClose })

    fireEvent.click(screen.getByRole('button', { name: 'Fechar configurações' }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
