import { cache } from 'react'

import {
  activeSessionSchema,
  sessionHistoryMetaSchema,
  sessionHistorySchema,
} from '@/lib/api/contracts/sessions'
import { accountProfileSchema } from '@/lib/api/contracts/accounts'
import { apiFetch, apiFetchWithMeta } from '@/lib/api/server-client'

export const getActiveSession = cache(() =>
  apiFetch('/sessions/active', { cache: 'no-store', schema: activeSessionSchema }),
)

export const getSessionHistory = cache(() =>
  apiFetchWithMeta('/sessions', {
    cache: 'no-store',
    metaSchema: sessionHistoryMetaSchema,
    schema: sessionHistorySchema,
  }),
)

export const getAccountProfile = cache(() =>
  apiFetch('/accounts/me', { cache: 'no-store', schema: accountProfileSchema }),
)
