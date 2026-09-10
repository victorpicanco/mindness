export type AccountPlan = 'free'

export type AccountKind = 'guest' | 'registered'

export interface AccountProfile {
  readonly kind: AccountKind
  readonly plan: AccountPlan
  readonly timeZone: string
}
