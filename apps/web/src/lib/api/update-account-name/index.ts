import { bffFetch } from '@/lib/api/bff-client'
import { updatedAccountNameSchema } from '@/lib/api/contracts/accounts'

export interface UpdateAccountNameInput {
  readonly fetcher?: typeof fetch
  readonly name: string
}

export async function updateAccountName({
  fetcher = fetch,
  name,
}: UpdateAccountNameInput): Promise<string> {
  const updated = await bffFetch('/accounts/me/name', {
    body: JSON.stringify({ name }),
    fetcher,
    headers: { 'content-type': 'application/json' },
    method: 'PATCH',
    schema: updatedAccountNameSchema,
  })

  return updated.name
}
