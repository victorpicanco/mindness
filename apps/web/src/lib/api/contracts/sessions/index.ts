import { z } from 'zod'

const sessionDifficultySchema = z.enum(['easy', 'balanced', 'hard'])

const sessionConfigurationSchema = z.object({
  categorySlug: z.string(),
  difficulty: sessionDifficultySchema,
  searchWindowMinutes: z.union([z.literal(3), z.literal(4), z.literal(5)]),
})

const sessionHistoryItemSchema = z.object({
  bestOfDay: z.boolean(),
  categorySlug: z.string(),
  difficulty: sessionDifficultySchema,
  localDate: z.string(),
  localTime: z.string(),
  sessionId: z.uuid(),
  startedAt: z.iso.datetime(),
  state: z.enum(['in_progress', 'expired', 'processing', 'completed', 'failed']),
  themeTitle: z.string().nullable(),
  totalScore: z.number().int().min(0).max(100).nullable(),
})

export const activeSessionSchema = z
  .strictObject({
    configuration: sessionConfigurationSchema,
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    recordingStartedAt: z.iso.datetime().nullable(),
    researchEndsAt: z.iso.datetime(),
    serverNow: z.iso.datetime(),
    sessionId: z.uuid(),
    themeId: z.uuid(),
    themeTitle: z.string(),
  })
  .nullable()

export const categoriesSchema = z.array(
  z.object({
    categoryId: z.uuid(),
    name: z.string(),
    slug: z.string(),
  }),
)

export const quotaSchema = z.discriminatedUnion('enforced', [
  z.object({
    allowance: z.number().nonnegative(),
    enforced: z.literal(true),
    remaining: z.number().nonnegative(),
    renewsAt: z.iso.datetime(),
  }),
  z.object({ enforced: z.literal(false) }),
])

export const audioUploadCredentialSchema = z.object({
  path: z.string(),
  token: z.string(),
  uploadUrl: z.string(),
})

export const confirmAudioUploadSchema = z.null()

export const abandonSessionSchema = z.null()

export const microphonePermissionDeniedSchema = z.null()

export const recordingStartedSchema = z.object({
  expiresAt: z.iso.datetime(),
  recordingStartedAt: z.iso.datetime(),
})

export const sessionHistorySchema = z.array(sessionHistoryItemSchema)

export const sessionHistoryMetaSchema = z.object({
  nextCursor: z.uuid().nullable(),
  pageSize: z.number().int().positive(),
  timeZone: z.string(),
})

export const startedSessionSchema = z.strictObject({
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  remaining: z.number().nonnegative().nullable(),
  researchEndsAt: z.iso.datetime(),
  serverNow: z.iso.datetime(),
  sessionId: z.uuid(),
  themeId: z.uuid(),
  themeTitle: z.string(),
})

export const sessionAnalysisAvailabilitySchema = z.object({
  sessionId: z.uuid(),
})

export type SessionHistoryItem = z.output<typeof sessionHistoryItemSchema>
