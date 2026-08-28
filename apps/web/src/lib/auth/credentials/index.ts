import { z } from 'zod'

import type { AuthActionMessageKey } from '@/lib/auth/form-validation'
import { passwordSchema } from '@/lib/auth/password-policy'

export const emailSchema = z.email().max(254)
export const captchaTokenSchema = z.string().min(1)

// Sign-in only checks the shape Supabase itself accepts: an existing password
// created before the current policy must still be usable to sign in.
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

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success
}

export function isValidNewPassword(value: string): boolean {
  return passwordSchema.safeParse(value).success
}
