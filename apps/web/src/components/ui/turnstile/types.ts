export type TurnstileRenderOptions = {
  readonly appearance: 'interaction-only'
  readonly callback: (token: string) => void
  readonly 'error-callback': (code: string) => void
  readonly 'expired-callback': () => void
  readonly sitekey: string
}

export type TurnstileApi = {
  readonly remove: (widgetId: string) => void
  readonly render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  readonly reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}
