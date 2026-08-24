'use client'

import { useEffect, useRef, useState } from 'react'

import type { TurnstileApi } from './types'

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export const TURNSTILE_TOKEN_FIELD_NAME = 'captchaToken'

type TurnstileProps = {
  readonly onError?: (code: string) => void
  readonly onVerify?: () => void
  readonly resetSignal?: number
  readonly siteKey: string
}

function subscribeToScript(onLoad: () => void, onError: () => void): () => void {
  const loaded = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
  const script = loaded ?? document.createElement('script')

  script.addEventListener('load', onLoad)
  script.addEventListener('error', onError)

  if (loaded === null) {
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    document.head.append(script)
  }

  return () => {
    script.removeEventListener('load', onLoad)
    script.removeEventListener('error', onError)
  }
}

export function Turnstile({ onError, onVerify, resetSignal, siteKey }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onErrorRef = useRef<((code: string) => void) | undefined>(onError)
  const onVerifyRef = useRef<(() => void) | undefined>(onVerify)
  const lastResetSignalRef = useRef(resetSignal)
  const [token, setToken] = useState('')

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    onVerifyRef.current = onVerify
  }, [onVerify])

  useEffect(() => {
    const container = containerRef.current

    if (container === null) return undefined

    const renderWidget = (api: TurnstileApi): void => {
      if (widgetIdRef.current !== null) return

      widgetIdRef.current = api.render(container, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: (value) => {
          setToken(value)
          onVerifyRef.current?.()
        },
        'error-callback': (code) => {
          setToken('')
          onErrorRef.current?.(code)
        },
        'expired-callback': () => {
          setToken('')
        },
      })
    }

    const available = window.turnstile
    const unsubscribe =
      available === undefined
        ? subscribeToScript(
            () => {
              const api = window.turnstile
              if (api !== undefined) renderWidget(api)
            },
            () => {
              onErrorRef.current?.('script-load-failed')
            },
          )
        : undefined

    if (available !== undefined) renderWidget(available)

    return () => {
      unsubscribe?.()
      const widgetId = widgetIdRef.current
      const api = window.turnstile

      if (widgetId !== null && api !== undefined) api.remove(widgetId)
      widgetIdRef.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (resetSignal === lastResetSignalRef.current) return

    lastResetSignalRef.current = resetSignal
    const widgetId = widgetIdRef.current
    const api = window.turnstile

    if (widgetId === null || api === undefined) return

    api.reset(widgetId)
    setToken('')
  }, [resetSignal])

  return (
    <div className="grid gap-1.5">
      <div ref={containerRef} />
      <input name={TURNSTILE_TOKEN_FIELD_NAME} readOnly type="hidden" value={token} />
    </div>
  )
}
