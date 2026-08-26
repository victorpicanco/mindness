import { bffFetch } from '@/lib/api/bff-client'
import { abandonSessionSchema } from '@/lib/api/contracts/sessions'

export async function abandonSession(sessionId: string): Promise<void> {
  await bffFetch(`/sessions/${sessionId}/abandon`, {
    method: 'POST',
    schema: abandonSessionSchema,
  })
}

export function abandonSessionOnPageHide(sessionId: string): void {
  const path = `/api/bff/sessions/${sessionId}/abandon`

  if (navigator.sendBeacon(path)) return

  void fetch(path, { keepalive: true, method: 'POST' })
}
