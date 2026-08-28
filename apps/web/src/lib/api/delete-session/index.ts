import { bffFetch } from '@/lib/api/bff-client'
import { deleteSessionSchema } from '@/lib/api/contracts/sessions'

export async function deleteSession(sessionId: string): Promise<void> {
  await bffFetch(`/sessions/${sessionId}`, {
    method: 'DELETE',
    schema: deleteSessionSchema,
  })
}
