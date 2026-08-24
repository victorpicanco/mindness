export interface UpdatePasswordInput {
  readonly authUserId: string
  readonly password: string
}

export interface UpdatePasswordOutput {
  readonly message: string
}
