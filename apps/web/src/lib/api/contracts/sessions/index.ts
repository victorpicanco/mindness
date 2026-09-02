import { z } from 'zod'

const sessionDifficultySchema = z.enum(['easy', 'balanced', 'hard'])

const sessionConfigurationSchema = z.object({
  categorySlug: z.string(),
  difficulty: sessionDifficultySchema,
  searchWindowMinutes: z.union([z.literal(3), z.literal(4), z.literal(5)]),
})

export type SessionConfiguration = z.output<typeof sessionConfigurationSchema>

const sessionHistoryItemSchema = z.object({
  categorySlug: z.string(),
  difficulty: sessionDifficultySchema,
  localDate: z.string(),
  localTime: z.string(),
  sessionId: z.uuid(),
  startedAt: z.iso.datetime(),
  state: z.enum(['in_progress', 'expired', 'processing', 'completed', 'failed']),
  themeTitle: z.string().nullable(),
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

export const audioUploadCredentialSchema = z.object({
  path: z.string(),
  token: z.string(),
  uploadUrl: z.string(),
})

export const confirmAudioUploadSchema = z.null()

export const abandonSessionSchema = z.null()

export const deleteSessionSchema = z.null()

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
  researchEndsAt: z.iso.datetime(),
  serverNow: z.iso.datetime(),
  sessionId: z.uuid(),
  themeId: z.uuid(),
  themeTitle: z.string(),
})

export const sessionAnalysisAvailabilitySchema = z.object({
  sessionId: z.uuid(),
})

export const sessionAnalysisSchema = z.strictObject({
  analyzedAt: z.iso.datetime(),
  feedback: z.strictObject({
    summary: z.string().min(1),
    strengths: z
      .array(
        z.strictObject({
          title: z.string().min(1),
          evidence: z.string().min(1),
        }),
      )
      .max(3),
    improvements: z
      .array(
        z.strictObject({
          title: z.string().min(1),
          evidence: z.string().min(1),
          action: z.string().min(1),
        }),
      )
      .max(3),
  }),
  sessionId: z.uuid(),
  transcript: z.string(),
})

export const audioPlaybackCredentialSchema = z.strictObject({
  expiresAt: z.iso.datetime(),
  signedUrl: z.url(),
})

export type SessionHistoryItem = z.output<typeof sessionHistoryItemSchema>
