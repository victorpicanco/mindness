export interface CreateAccountDeletionRequestParams {
  readonly id: string
  readonly accountId: string
  readonly requestedAt: Date
  readonly scheduledFor: Date
}

export class AccountDeletionRequest {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly requestedAt: Date,
    readonly scheduledFor: Date,
  ) {}

  static create(params: CreateAccountDeletionRequestParams): AccountDeletionRequest {
    return new AccountDeletionRequest(
      params.id,
      params.accountId,
      params.requestedAt,
      params.scheduledFor,
    )
  }
}
