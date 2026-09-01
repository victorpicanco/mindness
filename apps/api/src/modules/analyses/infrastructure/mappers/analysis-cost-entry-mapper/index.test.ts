import { describe, expect, it } from 'vitest'

import { AnalysisCostEntryMapper } from './index.js'

const entry = {
  id: 'cost-id',
  sessionId: 'session-id',
  accountId: 'account-id',
  transcriptionMicrosUsd: 10,
  evaluationMicrosUsd: 20,
  auditoryMicrosUsd: 0,
  synthesisMicrosUsd: 0,
  totalMicrosUsd: 30,
  incurredAt: new Date('2026-08-21T12:00:00.000Z'),
}

describe('AnalysisCostEntryMapper', () => {
  it('maps a cost entry without losing its date', () => {
    expect(new AnalysisCostEntryMapper().toData(entry)).toEqual(entry)
  })

  it('persists the breakdown of both Gemini passes', () => {
    const row = new AnalysisCostEntryMapper().toData({
      ...entry,
      evaluationMicrosUsd: 25,
      auditoryMicrosUsd: 10,
      synthesisMicrosUsd: 15,
    })

    expect(row.auditoryMicrosUsd).toBe(10)
    expect(row.synthesisMicrosUsd).toBe(15)
    expect(row.evaluationMicrosUsd).toBe(row.auditoryMicrosUsd + row.synthesisMicrosUsd)
  })
})
