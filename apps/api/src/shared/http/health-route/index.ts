import { Type, type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'

const HealthResponseSchema = Type.Object(
  { status: Type.Literal('ok') },
  { additionalProperties: false },
)

export function registerHealthRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<TypeBoxTypeProvider>()
    .get('/healthz', { schema: { response: { 200: HealthResponseSchema } } }, () => ({
      status: 'ok' as const,
    }))
}
