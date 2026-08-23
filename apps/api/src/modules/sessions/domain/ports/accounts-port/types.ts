export type AccountPlan = 'free'

export interface AccountProfile {
  readonly plan: AccountPlan
  readonly timeZone: string
}
