import { cache } from 'react'

import {
  activeSessionSchema,
  sessionHistoryMetaSchema,
  sessionHistorySchema,
} from '@/lib/api/contracts/sessions'
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
