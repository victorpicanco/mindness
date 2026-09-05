import { z } from 'zod'

export const ACCOUNT_NAME_MAX_LENGTH = 40

const accountConsentSchema = z.strictObject({
  acceptedAt: z.iso.datetime(),
  purpose: z.literal('voice_recording_and_analysis'),
  version: z.string().min(1),
})

export const accountProfileSchema = z.strictObject({
  accountId: z.uuid(),
  authenticationMethod: z.enum(['google', 'password']),
  consent: accountConsentSchema.nullable(),
  createdAt: z.iso.datetime(),
  email: z.email(),
  name: z.string().min(1).max(ACCOUNT_NAME_MAX_LENGTH).nullable(),
  plan: z.literal('free'),
  timeZone: z.string().min(1),
})

export type AccountProfile = z.output<typeof accountProfileSchema>

export const updatedAccountNameSchema = z.strictObject({
  name: z.string().min(1).max(ACCOUNT_NAME_MAX_LENGTH),
})
