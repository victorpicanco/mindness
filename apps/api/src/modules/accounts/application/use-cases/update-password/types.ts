import type { AuthenticationMethod } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

export interface UpdatePasswordInput {
  readonly authUserId: string
  readonly authenticationMethod: AuthenticationMethod
  readonly password: string
}

export interface UpdatePasswordOutput {
  readonly message: string
}
