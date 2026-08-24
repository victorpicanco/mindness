import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Turnstile, TURNSTILE_SCRIPT_URL } from './index'
import type { TurnstileApi, TurnstileRenderOptions } from './types'

type RenderedWidget = {
  readonly options: TurnstileRenderOptions
  readonly widgetId: string
}

function createTurnstileApi(): { api: TurnstileApi; rendered: RenderedWidget[]; reset: string[] } {
  const rendered: RenderedWidget[] = []
  const reset: string[] = []

  const api: TurnstileApi = {
    render: (_container, options) => {
      const widgetId = `widget-${String(rendered.length)}`
      rendered.push({ options, widgetId })

      return widgetId
    },
    remove: () => {},
    reset: (widgetId) => {
      reset.push(widgetId)
    },
  }

  return { api, rendered, reset }
}

function tokenFieldValue(container: HTMLElement): string | undefined {
  return container.querySelector<HTMLInputElement>('input[name="captchaToken"]')?.value
}

function turnstileScripts(): HTMLScriptElement[] {
  return [...document.querySelectorAll<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`)]
}

afterEach(() => {
  cleanup()
  delete window.turnstile
  for (const script of turnstileScripts()) script.remove()
})

describe('Turnstile', () => {
  it('submits an empty token before the visitor is verified', () => {
    const { api } = createTurnstileApi()
    window.turnstile = api

    const { container } = render(<Turnstile siteKey="site-key" />)

    expect(tokenFieldValue(container)).toBe('')
  })

  it('renders the widget with the configured site key when the script is already loaded', async () => {
    const { api, rendered } = createTurnstileApi()
    window.turnstile = api

    render(<Turnstile siteKey="site-key" />)

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })
    expect(rendered[0]?.options.sitekey).toBe('site-key')
  })

  it('keeps the widget hidden until visitor interaction is required', async () => {
    const { api, rendered } = createTurnstileApi()
    window.turnstile = api

    render(<Turnstile siteKey="site-key" />)

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })
    expect(rendered[0]?.options).toMatchObject({ appearance: 'interaction-only' })
  })

  it('carries the token of a successful verification into the form field', async () => {
    const { api, rendered } = createTurnstileApi()
    window.turnstile = api

    const { container } = render(<Turnstile siteKey="site-key" />)

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })
    rendered[0]?.options.callback('verified-token')

    await waitFor(() => {
      expect(tokenFieldValue(container)).toBe('verified-token')
    })
  })

  it('clears the token when the verification expires', async () => {
    const { api, rendered } = createTurnstileApi()
    window.turnstile = api

    const { container } = render(<Turnstile siteKey="site-key" />)

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })
    rendered[0]?.options.callback('verified-token')
    await waitFor(() => {
      expect(tokenFieldValue(container)).toBe('verified-token')
    })

    rendered[0]?.options['expired-callback']()

    await waitFor(() => {
      expect(tokenFieldValue(container)).toBe('')
    })
  })

  it('tells the caller when a token becomes available and when it is gone', async () => {
    const { api, rendered } = createTurnstileApi()
    window.turnstile = api
    const tokens: string[] = []

    render(
      <Turnstile
        onTokenChange={(token) => {
          tokens.push(token)
        }}
        siteKey="site-key"
      />,
    )

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })
    rendered[0]?.options.callback('verified-token')
    rendered[0]?.options['expired-callback']()

    await waitFor(() => {
      expect(tokens).toEqual(['verified-token', ''])
    })
  })

  it('clears the token when the interactive challenge times out', async () => {
    const { api, rendered } = createTurnstileApi()
    window.turnstile = api

    const { container } = render(<Turnstile siteKey="site-key" />)

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })
    rendered[0]?.options.callback('verified-token')
    await waitFor(() => {
      expect(tokenFieldValue(container)).toBe('verified-token')
    })

    rendered[0]?.options['timeout-callback']()

    await waitFor(() => {
      expect(tokenFieldValue(container)).toBe('')
    })
  })

  it('clears the token when the caller resets the widget', async () => {
    const { api, rendered } = createTurnstileApi()
    window.turnstile = api

    const { container, rerender } = render(<Turnstile resetSignal={0} siteKey="site-key" />)

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })
    rendered[0]?.options.callback('verified-token')
    await waitFor(() => {
      expect(tokenFieldValue(container)).toBe('verified-token')
    })

    rerender(<Turnstile resetSignal={1} siteKey="site-key" />)

    await waitFor(() => {
      expect(tokenFieldValue(container)).toBe('')
    })
  })

  it('reports a widget failure to the caller', async () => {
    const { api, rendered } = createTurnstileApi()
    window.turnstile = api
    const failures: string[] = []

    render(
      <Turnstile
        onError={(code) => {
          failures.push(code)
        }}
        siteKey="site-key"
      />,
    )

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })
    rendered[0]?.options['error-callback']('network-error')

    expect(failures).toEqual(['network-error'])
  })

  it('loads the widget script when the API is not available yet', async () => {
    const { api, rendered } = createTurnstileApi()

    render(<Turnstile siteKey="site-key" />)

    await waitFor(() => {
      expect(turnstileScripts()).toHaveLength(1)
    })
    const script = turnstileScripts()[0]
    expect(script?.async).toBe(true)

    window.turnstile = api
    script?.dispatchEvent(new Event('load'))

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })
  })

  it('loads the script only once for two widgets on the same page', async () => {
    render(
      <>
        <Turnstile siteKey="site-key" />
        <Turnstile siteKey="site-key" />
      </>,
    )

    await waitFor(() => {
      expect(turnstileScripts()).toHaveLength(1)
    })
  })

  it('reports a script loading failure to the caller', async () => {
    const failures: string[] = []

    render(
      <Turnstile
        onError={(code) => {
          failures.push(code)
        }}
        siteKey="site-key"
      />,
    )

    await waitFor(() => {
      expect(turnstileScripts()).toHaveLength(1)
    })
    turnstileScripts()[0]?.dispatchEvent(new Event('error'))

    expect(failures).toEqual(['script-load-failed'])
  })

  it('resets the widget when the caller changes the reset signal', async () => {
    const { api, rendered, reset } = createTurnstileApi()
    window.turnstile = api

    const { rerender } = render(<Turnstile resetSignal={0} siteKey="site-key" />)

    await waitFor(() => {
      expect(rendered).toHaveLength(1)
    })

    rerender(<Turnstile resetSignal={1} siteKey="site-key" />)

    await waitFor(() => {
      expect(reset).toEqual(['widget-0'])
    })
  })
})
