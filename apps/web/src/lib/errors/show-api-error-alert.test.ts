import { afterEach, describe, expect, it, vi } from 'vitest'

import { alertDialogStore, dismissAlertDialog } from '@/lib/feedback/alert-dialog'

import { showApiErrorAlert, type AlertTranslator } from './show-api-error-alert'

afterEach(() => {
  dismissAlertDialog()
})

function fakeTranslator(known: Record<string, string>): AlertTranslator {
  return (key) => known[key] ?? ''
}

const t = fakeTranslator({
  'common.alerts.failureTitle': 'Não foi possível continuar',
  'home.research.audioUploadFailed': 'Não foi possível enviar sua gravação.',
  'home.research.microphoneError': 'Não conseguimos acessar seu microfone.',
})

describe('showApiErrorAlert', () => {
  it('raises a blocking failure as a dialog the user has to acknowledge', () => {
    showApiErrorAlert({ code: 'web.MICROPHONE_UNAVAILABLE', issues: null, requestId: null }, t)

    expect(alertDialogStore.getState().request).toEqual({
      description: 'Não conseguimos acessar seu microfone.',
      title: 'Não foi possível continuar',
    })
  })

  it('carries the choices the failure leaves open', () => {
    const onSelect = vi.fn()

    showApiErrorAlert({ code: 'web.AUDIO_UPLOAD_FAILED', issues: null, requestId: null }, t, [
      { label: 'Tentar de novo', onSelect },
    ])

    expect(alertDialogStore.getState().request?.actions).toEqual([
      { label: 'Tentar de novo', onSelect },
    ])
  })

  it('leaves a toast error to the toast channel', () => {
    showApiErrorAlert({ code: 'accounts.RATE_LIMITED', issues: null, requestId: null }, t)

    expect(alertDialogStore.getState().request).toBeNull()
  })

  it('leaves an inline field error on the field', () => {
    showApiErrorAlert({ code: 'accounts.CAPTCHA_REJECTED', issues: null, requestId: null }, t)

    expect(alertDialogStore.getState().request).toBeNull()
  })

  it('stays quiet for a silent error the caller handles on its own', () => {
    showApiErrorAlert({ code: 'sessions.GUEST_TRIAL_CONSUMED', issues: null, requestId: null }, t)

    expect(alertDialogStore.getState().request).toBeNull()
  })
})
