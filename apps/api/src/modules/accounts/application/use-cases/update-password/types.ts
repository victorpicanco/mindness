export interface UpdatePasswordInput {
  readonly accessToken: string
  readonly authUserId: string
  readonly password: string
}

export interface UpdatePasswordOutput {
  readonly message: string
}
