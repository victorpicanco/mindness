export interface CreateAccountParams {
  readonly id: string
  readonly email: string
  readonly authUserId: string
  readonly timeZone: string
  readonly createdAt: Date
}

export class Account {
  readonly plan = 'free'
  readonly status = 'accessible'

  private constructor(
    readonly id: string,
    readonly email: string,
    readonly authUserId: string,
    readonly timeZone: string,
    readonly createdAt: Date,
  ) {}

  static create(params: CreateAccountParams): Account {
    return new Account(
      params.id,
      params.email,
      params.authUserId,
      params.timeZone,
      params.createdAt,
    )
  }
}
