export type SessionDayHeading =
  | { readonly kind: 'today' }
  | { readonly kind: 'yesterday' }
  | { readonly kind: 'date'; readonly value: string }

export interface SessionGroupItem {
  readonly href: string
  readonly sessionId: string
  readonly title: string | null
}

export interface SessionDayGroup {
  readonly heading: SessionDayHeading
  readonly items: readonly SessionGroupItem[]
  readonly localDate: string
}
