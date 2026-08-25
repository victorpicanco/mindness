import { z } from 'zod'

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    issues: z.array(z.object({ field: z.string(), message: z.string() })).nullable(),
    message: z.string(),
    requestId: z.string(),
  }),
})

export const successEnvelopeSchema = z.object({
  data: z.unknown(),
  meta: z.unknown().optional(),
})
