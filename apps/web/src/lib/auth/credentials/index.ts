import { z } from 'zod'

import type { AuthActionMessageKey } from '@/lib/auth/form-validation'

export const emailSchema = z.email().max(254)
export const captchaTokenSchema = z.string().min(1)
export const signInPasswordSchema = z.string().min(8).max(64)

type AuthCredentials = {
  readonly captchaToken: string
  readonly email: string
  readonly password: string
}

function messageKeyOfField(field: PropertyKey | undefined): AuthActionMessageKey {
  if (field === 'captchaToken') return 'errors.captchaRequired'

  return field === 'email' ? 'errors.invalidEmail' : 'errors.invalidPassword'
}

export function credentialsMessageKey(
  credentials: AuthCredentials,
  password: z.ZodType<string>,
): AuthActionMessageKey | undefined {
  const validation = z
    .object({ captchaToken: captchaTokenSchema, email: emailSchema, password })
    .safeParse(credentials)

  if (validation.success) return undefined

  return messageKeyOfField(validation.error.issues[0]?.path[0])
}
