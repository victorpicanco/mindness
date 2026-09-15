import { z } from 'zod'

export const ACCOUNT_NAME_MAX_LENGTH = 40

const accountConsentSchema = z.strictObject({
  acceptedAt: z.iso.datetime(),
  purpose: z.literal('voice_recording_and_analysis'),
  version: z.string().min(1),
})

const sharedAccountProfile = {
  accountId: z.uuid(),
  consent: accountConsentSchema.nullable(),
  createdAt: z.iso.datetime(),
  name: z.string().min(1).max(ACCOUNT_NAME_MAX_LENGTH).nullable(),
  plan: z.literal('free'),
  timeZone: z.string().min(1),
}

const guestAccountProfileSchema = z.strictObject({
  ...sharedAccountProfile,
  accountKind: z.literal('guest'),
  authenticationMethod: z.literal('anonymous'),
  email: z.null(),
})

const registeredAccountProfileSchema = z.strictObject({
  ...sharedAccountProfile,
  accountKind: z.literal('registered'),
  authenticationMethod: z.enum(['google', 'password']),
  email: z.email(),
})

export const accountProfileSchema = z.discriminatedUnion('accountKind', [
  guestAccountProfileSchema,
  registeredAccountProfileSchema,
])

export type AccountProfile = z.output<typeof accountProfileSchema>

export const updatedAccountNameSchema = z.strictObject({
  name: z.string().min(1).max(ACCOUNT_NAME_MAX_LENGTH),
})
