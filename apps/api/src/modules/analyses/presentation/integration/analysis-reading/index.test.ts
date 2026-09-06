import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  ANALYSES_TEST_NOW,
  createAnalysesIntegrationContainer,
  type AnalysesIntegrationContainer,
} from '@/modules/analyses/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearAnalysesData,
} from '@/modules/analyses/composition/integration-fixtures.js'
import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { createDetailedFeedback } from '@/modules/analyses/infrastructure/adapters/gemini-evaluation-adapter/fixtures.js'
import { parseEvaluationFeedback } from '@/modules/analyses/infrastructure/adapters/gemini-evaluation-adapter/schemas.js'

const ACCOUNT_A = '00000000-0000-4000-8000-000000000101'
const ACCOUNT_B = '00000000-0000-4000-8000-000000000102'
const SESSION_ID = '00000000-0000-4000-8000-000000000001'
const feedback = {
  summary: 'The message is clear and direct.',
  strengths: [{ title: 'Opening', evidence: 'The main point appears immediately.' }],
  improvements: [
    { title: 'Closing', evidence: 'The ending trails off.', action: 'Repeat the main point.' },
  ],
}

interface AnalysisResponse {
  readonly data: {
    readonly sessionId: string
    readonly feedback: typeof feedback
    readonly transcript: string
    readonly analyzedAt: string
  }
}

let harness: AnalysesIntegrationContainer

beforeAll(async () => {
  harness = await createAnalysesIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await harness.close()
})

beforeEach(async () => {
  await clearAnalysesData(harness.prisma)
  harness.reset()
  harness.accounts.registerIdentity('account-a', ACCOUNT_A)
  harness.accounts.registerIdentity('account-b', ACCOUNT_B)
  harness.accounts.setPlan(ACCOUNT_A, 'free')
  harness.sessions.setReadable(SESSION_ID, ACCOUNT_A)
  await harness.repositories.analyses.save(
    Analysis.create({
      analysisId: '00000000-0000-4000-8000-000000001001',
      sessionId: SESSION_ID,
      feedback,
      processingMs: 1_000,
      costMicrosUsd: 10,
      createdAt: ANALYSES_TEST_NOW,
    }),
  )
  await harness.repositories.transcriptions.save(
    Transcription.create({
      transcriptionId: '00000000-0000-4000-8000-000000002001',
      sessionId: SESSION_ID,
      text: 'Literal transcript.',
      words: [{ word: 'Literal', start: 0, end: 1, confidence: 1 }],
      durationSeconds: 1,
      createdAt: ANALYSES_TEST_NOW,
    }),
  )
})

function read(accessToken: string) {
  return harness.app.inject({
    method: 'GET',
    url: `/sessions/${SESSION_ID}/analysis`,
    headers: { authorization: `Bearer ${accessToken}` },
  })
}

describe('analysis reading integration', () => {
  it('persists nullable measurements and exposes timed evidence without changing legacy readings', async () => {
    const detailed = parseEvaluationFeedback(
      createDetailedFeedback(),
      { durationSeconds: 30, wordCount: 0, wordsPerMinute: null, windows: [] },
      'test-model',
    )
    await harness.repositories.analyses.save(
      Analysis.create({
        analysisId: '00000000-0000-4000-8000-000000001001',
        sessionId: SESSION_ID,
        feedback: detailed,
        processingMs: 100,
        costMicrosUsd: 20,
        createdAt: ANALYSES_TEST_NOW,
      }),
    )

    const response = await read('account-a')
    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/{sessionId}/analysis', response, 200)
    expect(response.json<AnalysisResponse>().data.feedback).toEqual(detailed)
    expect((await harness.repositories.analyses.findBySessionId(SESSION_ID))?.feedback).toEqual(
      detailed,
    )
    expect(harness.eventBus.published).toHaveLength(1)
    expect(harness.eventBus.published[0]?.payload).toEqual({
      sessionId: SESSION_ID,
      accountId: ACCOUNT_A,
      plan: 'free',
    })

    const forbidden = await read('account-b')
    expect(forbidden.statusCode).toBe(404)
    assertResponseMatchesSchema(
      harness.app,
      'GET',
      '/sessions/{sessionId}/analysis',
      forbidden,
      404,
    )
    expect(harness.eventBus.published).toHaveLength(1)
  })
  it('returns feedback and transcript through the documented contract', async () => {
    const response = await read('account-a')

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/{sessionId}/analysis', response, 200)
    expect(response.json<AnalysisResponse>().data).toEqual({
      sessionId: SESSION_ID,
      feedback,
      transcript: 'Literal transcript.',
      analyzedAt: ANALYSES_TEST_NOW.toISOString(),
    })
  })

  it('publishes only one content-free viewed event', async () => {
    await read('account-a')
    await read('account-a')

    expect(harness.eventBus.published).toHaveLength(1)
    expect(harness.eventBus.published[0]?.payload).toEqual({
      sessionId: SESSION_ID,
      accountId: ACCOUNT_A,
      plan: 'free',
    })
  })

  it('returns 404 to another account', async () => {
    const response = await read('account-b')

    expect(response.statusCode).toBe(404)
  })
})
