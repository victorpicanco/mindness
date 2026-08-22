import { describe, expect, it } from 'vitest'

import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import type { AnalysesRepository } from '@/modules/analyses/domain/repositories/analyses-repository/index.js'
import type { SessionsPort } from '@/modules/analyses/domain/ports/sessions-port/index.js'
import { PillarScore } from '@/modules/analyses/domain/value-objects/pillar-score/index.js'
import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import { ReconcileOrphanAnalysesUseCase } from './index.js'

const NOW = new Date('2026-08-21T12:02:00.000Z')

function createAnalysis(sessionId: string): Analysis {
  return Analysis.create({
    analysisId: `analysis-${sessionId}`,
    sessionId,
    clarityScore: PillarScore.create(80),
    rhythmScore: PillarScore.create(80),
    fluencyScore: PillarScore.create(80),
    masteryScore: PillarScore.create(80),
    clarityGuidance: 'Clear',
    rhythmGuidance: 'Steady',
    fluencyGuidance: 'Fluid',
    masteryGuidance: 'Strong',
    rhythmMetrics: RhythmMetrics.create({
      wordsPerMinute: 120,
      wordCount: 100,
      speechDurationSeconds: 50,
      pauseCount: 2,
      longPauseCount: 0,
      longestPauseSeconds: 1,
    }),
    processingMs: 1_000,
    costMicrosUsd: 1_000,
    createdAt: NOW,
  })
}

function createHarness(input: {
  readonly stuckSessionIds: readonly string[]
  readonly existingAnalyses?: readonly Analysis[]
}) {
  const listStuckProcessingQueries: { before: Date; limit: number }[] = []
  const enqueued: { readonly sessionId: string }[] = []
  const sessions: SessionsPort = {
    findProcessingContext: () => Promise.resolve(null),
    listStuckProcessing: (before, limit) => {
      listStuckProcessingQueries.push({ before, limit })
      return Promise.resolve(input.stuckSessionIds)
    },
  }
  const analyses: Pick<AnalysesRepository, 'findBySessionId'> = {
    findBySessionId: (sessionId) =>
      Promise.resolve(
        (input.existingAnalyses ?? []).find((analysis) => analysis.sessionId === sessionId) ?? null,
      ),
  }
  const processingQueue = {
    enqueue: (job: { readonly sessionId: string }) => {
      enqueued.push(job)
      return Promise.resolve()
    },
  }
  const useCase = new ReconcileOrphanAnalysesUseCase({
    sessions,
    analyses,
    processingQueue,
    clock: { now: () => NOW },
  })

  return { useCase, listStuckProcessingQueries, enqueued }
}

describe('ReconcileOrphanAnalysesUseCase', () => {
  it('reenqueues stuck sessions that have no analysis yet', async () => {
    const harness = createHarness({ stuckSessionIds: ['session-1', 'session-2'] })

    await expect(harness.useCase.execute({ staleAfterMs: 60_000, limit: 100 })).resolves.toEqual({
      reconciledCount: 2,
    })

    expect(harness.listStuckProcessingQueries).toEqual([
      { before: new Date('2026-08-21T12:01:00.000Z'), limit: 100 },
    ])
    expect(harness.enqueued).toEqual([{ sessionId: 'session-1' }, { sessionId: 'session-2' }])
  })

  it('does not reenqueue a session that already has an analysis', async () => {
    const harness = createHarness({
      stuckSessionIds: ['session-1'],
      existingAnalyses: [createAnalysis('session-1')],
    })

    await expect(harness.useCase.execute({ staleAfterMs: 60_000, limit: 100 })).resolves.toEqual({
      reconciledCount: 0,
    })

    expect(harness.enqueued).toEqual([])
  })

  it('reports no reconciliation when no session is stuck', async () => {
    const harness = createHarness({ stuckSessionIds: [] })

    await expect(harness.useCase.execute({ staleAfterMs: 60_000, limit: 100 })).resolves.toEqual({
      reconciledCount: 0,
    })

    expect(harness.enqueued).toEqual([])
  })
})
