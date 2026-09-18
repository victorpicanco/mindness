import { afterEach, describe, expect, it, vi } from 'vitest'

import { alertDialogStore, dismissAlertDialog, showAlertDialog } from './index'

afterEach(() => {
  dismissAlertDialog()
})

describe('alert dialog channel', () => {
  it('starts with nothing to announce', () => {
    expect(alertDialogStore.getState().request).toBeNull()
  })

  it('holds the request until it is dismissed', () => {
    showAlertDialog({ description: 'O link expirou.', title: 'Link inválido' })

    expect(alertDialogStore.getState().request).toEqual({
      description: 'O link expirou.',
      title: 'Link inválido',
    })

    dismissAlertDialog()

    expect(alertDialogStore.getState().request).toBeNull()
  })

  it('replaces a pending request with the newest one', () => {
    showAlertDialog({ description: 'Primeira.', title: 'Primeira' })
    showAlertDialog({ description: 'Segunda.', title: 'Segunda' })

    expect(alertDialogStore.getState().request?.title).toBe('Segunda')
  })

  it('carries the choices the user has to make', () => {
    const onSelect = vi.fn()

    showAlertDialog({
      actions: [{ label: 'Tentar de novo', onSelect }],
      description: 'O envio falhou.',
      title: 'Envio interrompido',
    })

    alertDialogStore.getState().request?.actions?.[0]?.onSelect()

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('notifies subscribers when a request arrives', () => {
    const subscriber = vi.fn()
    const unsubscribe = alertDialogStore.subscribe(subscriber)

    showAlertDialog({ description: 'Algo aconteceu.', title: 'Aviso' })
    unsubscribe()

    expect(subscriber).toHaveBeenCalledOnce()
  })
})
