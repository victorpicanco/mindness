import { describe, expect, it } from 'vitest'

import { AnalysisCostEntryMapper } from './index.js'

const entry = {
  id: 'cost-id',
  sessionId: 'session-id',
  accountId: 'account-id',
  transcriptionMicrosUsd: 10,
  evaluationMicrosUsd: 20,
  totalMicrosUsd: 30,
  incurredAt: new Date('2026-08-21T12:00:00.000Z'),
}

describe('AnalysisCostEntryMapper', () => {
  it('maps a cost entry without losing its date', () => {
    expect(new AnalysisCostEntryMapper().toData(entry)).toEqual(entry)
  })
})
