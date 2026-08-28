import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import { PillarScore } from '@/modules/analyses/domain/value-objects/pillar-score/index.js'
import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'
import {
  ANALYSES_TEST_NOW,
  createAnalysesIntegrationContainer,
  type AnalysesIntegrationContainer,
} from '@/modules/analyses/composition/integration-container.js'
import {
  assertResponseMatchesSchema,
  clearAnalysesData,
} from '@/modules/analyses/composition/integration-fixtures.js'

const ACCOUNT_A = '00000000-0000-4000-8000-000000000101'
const ACCOUNT_B = '00000000-0000-4000-8000-000000000102'

interface AnalysisResponseBody {
  readonly data: {
    readonly sessionId: string
    readonly scores: {
      readonly clarity: number
      readonly rhythm: number
      readonly fluency: number
      readonly mastery: number
      readonly total: number
    }
    readonly guidance: readonly { readonly pillar: string; readonly text: string }[]
    readonly transcript: string
    readonly analyzedAt: string
  }
}

let harness: AnalysesIntegrationContainer

function uuid(suffix: number): string {
  return `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, '0')}`
}

const RHYTHM_METRICS = RhythmMetrics.create({
  wordsPerMinute: 120,
  wordCount: 100,
  speechDurationSeconds: 50,
  pauseCount: 5,
  longPauseCount: 1,
  longestPauseSeconds: 2,
})

async function seedAnalysis(input: {
  readonly sessionId: string
  readonly analysisId: string
  readonly transcriptionId: string
  readonly clarity: number
  readonly rhythm: number
  readonly fluency: number
  readonly mastery: number
  readonly transcript?: string
}): Promise<void> {
  const analysis = Analysis.create({
    analysisId: input.analysisId,
    sessionId: input.sessionId,
    clarityScore: PillarScore.create(input.clarity),
    rhythmScore: PillarScore.create(input.rhythm),
    fluencyScore: PillarScore.create(input.fluency),
    masteryScore: PillarScore.create(input.mastery),
    clarityGuidance: 'Slow down on difficult words',
    rhythmGuidance: 'Vary your pace between sentences',
    fluencyGuidance: 'Reduce filler words',
    masteryGuidance: 'Cover more of the theme prompts',
    rhythmMetrics: RHYTHM_METRICS,
    processingMs: 1_500,
    costMicrosUsd: 4_200,
    createdAt: ANALYSES_TEST_NOW,
  })
  const transcription = Transcription.create({
    transcriptionId: input.transcriptionId,
    sessionId: input.sessionId,
    text: input.transcript ?? 'This is what the person said during the session.',
    words: [{ word: 'This', start: 0, end: 0.5, confidence: 0.9 }],
    durationSeconds: 50,
    createdAt: ANALYSES_TEST_NOW,
  })

  await harness.repositories.analyses.save(analysis)
  await harness.repositories.transcriptions.save(transcription)
}

function getAnalysis(
  sessionId: string,
  accessToken: string,
): Promise<Awaited<ReturnType<typeof harness.app.inject>>> {
  return harness.app.inject({
    method: 'GET',
    url: `/sessions/${sessionId}/analysis`,
    headers: { authorization: `Bearer ${accessToken}` },
  })
}

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
})

describe('analysis reading integration', () => {
  it('returns the envelope with the five scores, guidance and transcript, without any sensitive analysis data', async () => {
    const sessionId = uuid(1)
    harness.sessions.setReadable(sessionId, ACCOUNT_A)
    await seedAnalysis({
      sessionId,
      analysisId: uuid(1001),
      transcriptionId: uuid(2001),
      clarity: 70,
      rhythm: 75,
      fluency: 60,
      mastery: 85,
    })

    const response = await getAnalysis(sessionId, 'account-a')

    expect(response.statusCode).toBe(200)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/{sessionId}/analysis', response, 200)
    const body = response.json<AnalysisResponseBody>()
    expect(body.data.scores).toEqual({
      clarity: 70,
      rhythm: 75,
      fluency: 60,
      mastery: 85,
      total: 73,
    })
    expect(body.data.transcript).toBe('This is what the person said during the session.')

    const dataKeys = Object.keys(body.data)
    expect(dataKeys).not.toContain('words')
    expect(dataKeys).not.toContain('averageConfidence')
    expect(dataKeys).not.toContain('costMicrosUsd')
    expect(dataKeys).not.toContain('processingMs')
    expect(dataKeys).not.toContain('rhythmMetrics')
  })

  it('returns two guidances when two pillars are below the threshold, and exactly one — the lowest — when all four are at or above it', async () => {
    const belowThresholdSessionId = uuid(2)
    harness.sessions.setReadable(belowThresholdSessionId, ACCOUNT_A)
    await seedAnalysis({
      sessionId: belowThresholdSessionId,
      analysisId: uuid(1002),
      transcriptionId: uuid(2002),
      clarity: 70,
      rhythm: 90,
      fluency: 60,
      mastery: 85,
    })

    const belowThresholdResponse = await getAnalysis(belowThresholdSessionId, 'account-a')
    expect(belowThresholdResponse.statusCode).toBe(200)
    expect(
      belowThresholdResponse.json<AnalysisResponseBody>().data.guidance.map((item) => item.pillar),
    ).toEqual(['clarity', 'fluency'])

    const allAboveSessionId = uuid(3)
    harness.sessions.setReadable(allAboveSessionId, ACCOUNT_A)
    await seedAnalysis({
      sessionId: allAboveSessionId,
      analysisId: uuid(1003),
      transcriptionId: uuid(2003),
      clarity: 90,
      rhythm: 95,
      fluency: 85,
      mastery: 80,
    })

    const allAboveResponse = await getAnalysis(allAboveSessionId, 'account-a')
    expect(allAboveResponse.statusCode).toBe(200)
    const allAboveGuidance = allAboveResponse.json<AnalysisResponseBody>().data.guidance
    expect(allAboveGuidance).toHaveLength(1)
    expect(allAboveGuidance[0]?.pillar).toBe('mastery')
  })

  it('renders the transcript as an identical JSON string, never as HTML', async () => {
    const sessionId = uuid(4)
    harness.sessions.setReadable(sessionId, ACCOUNT_A)
    const payload = '<script>alert(1)</script>'
    await seedAnalysis({
      sessionId,
      analysisId: uuid(1004),
      transcriptionId: uuid(2004),
      clarity: 80,
      rhythm: 80,
      fluency: 80,
      mastery: 80,
      transcript: payload,
    })

    const response = await getAnalysis(sessionId, 'account-a')

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/json')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.json<AnalysisResponseBody>().data.transcript).toBe(payload)
  })

  it('publishes analysis_viewed only on the first read and marks the view timestamp once', async () => {
    const sessionId = uuid(5)
    harness.sessions.setReadable(sessionId, ACCOUNT_A)
    await seedAnalysis({
      sessionId,
      analysisId: uuid(1005),
      transcriptionId: uuid(2005),
      clarity: 70,
      rhythm: 75,
      fluency: 60,
      mastery: 85,
    })

    const firstResponse = await getAnalysis(sessionId, 'account-a')
    expect(firstResponse.statusCode).toBe(200)
    const firstBody = firstResponse.json<AnalysisResponseBody>()

    expect(harness.eventBus.published).toHaveLength(1)
    expect(harness.eventBus.published[0]).toMatchObject({
      eventName: 'analysis_viewed',
      payload: {
        accountId: ACCOUNT_A,
        plan: 'free',
        scores: { clarity: 70, rhythm: 75, fluency: 60, mastery: 85, total: 73 },
      },
    })
    const firstViewedAt = await harness.prisma.analysis.findUnique({ where: { sessionId } })
    expect(firstViewedAt?.viewedAt).not.toBeNull()

    const secondResponse = await getAnalysis(sessionId, 'account-a')
    expect(secondResponse.statusCode).toBe(200)
    expect(secondResponse.json<AnalysisResponseBody>()).toEqual(firstBody)
    expect(harness.eventBus.published).toHaveLength(1)

    const secondViewedAt = await harness.prisma.analysis.findUnique({ where: { sessionId } })
    expect(secondViewedAt?.viewedAt).toEqual(firstViewedAt?.viewedAt)

    expect(harness.logs.length).toBeGreaterThan(0)
    for (const line of harness.logs) {
      expect(line).not.toContain(firstBody.data.transcript)
    }
  })

  it('rejects a malformed session id with a documented 400', async () => {
    const response = await getAnalysis('not-a-uuid', 'account-a')

    expect(response.statusCode).toBe(400)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/{sessionId}/analysis', response, 400)
    expect(response.json()).toMatchObject({ error: { code: 'shared.VALIDATION_FAILED' } })
  })

  it('treats a readable session without a persisted analysis as not found', async () => {
    const sessionId = uuid(6)
    harness.sessions.setReadable(sessionId, ACCOUNT_A)

    const response = await getAnalysis(sessionId, 'account-a')

    expect(response.statusCode).toBe(404)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/{sessionId}/analysis', response, 404)
    expect(response.json()).toMatchObject({ error: { code: 'analyses.ANALYSIS_NOT_FOUND' } })
  })

  it.each([
    ['analysis_failed', 'analyses.ANALYSIS_FAILED', 8],
    ['analysis_timeout', 'analyses.ANALYSIS_TIMEOUT', 9],
  ] as const)(
    'returns the terminal %s outcome for polling clients',
    async (failure, code, seed) => {
      const sessionId = uuid(seed)
      harness.sessions.setReadable(sessionId, ACCOUNT_A)
      harness.sessions.setAnalysisFailure(sessionId, failure)

      const response = await getAnalysis(sessionId, 'account-a')

      expect(response.statusCode).toBe(422)
      assertResponseMatchesSchema(
        harness.app,
        'GET',
        '/sessions/{sessionId}/analysis',
        response,
        422,
      )
      expect(response.json()).toMatchObject({ error: { code } })
    },
  )

  it('treats an unreadable session as not found, indistinguishable from a missing one, and publishes nothing', async () => {
    const sessionId = uuid(7)
    harness.sessions.setReadable(sessionId, ACCOUNT_A)
    await seedAnalysis({
      sessionId,
      analysisId: uuid(1007),
      transcriptionId: uuid(2007),
      clarity: 70,
      rhythm: 75,
      fluency: 60,
      mastery: 85,
    })

    const response = await getAnalysis(sessionId, 'account-b')

    expect(response.statusCode).toBe(404)
    assertResponseMatchesSchema(harness.app, 'GET', '/sessions/{sessionId}/analysis', response, 404)
    expect(response.json()).toMatchObject({ error: { code: 'analyses.ANALYSIS_NOT_FOUND' } })
    expect(harness.eventBus.published).toEqual([])
  })
})
