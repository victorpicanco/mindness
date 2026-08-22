import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  ANALYSES_TEST_NOW,
  createAnalysesIntegrationContainer,
  type AnalysesIntegrationContainer,
} from '@/modules/analyses/composition/integration-container.js'
import { clearAnalysesData } from '@/modules/analyses/composition/integration-fixtures.js'
import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'

let harness: AnalysesIntegrationContainer
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000002'
const THEME_ID = '00000000-0000-0000-0000-000000000003'

beforeAll(async () => {
  harness = await createAnalysesIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await harness.close()
})

beforeEach(async () => {
  await clearAnalysesData(harness.prisma)
  harness.reset()
  harness.accounts.setPlan(ACCOUNT_ID, 'free')
  harness.themes.setTitle(THEME_ID, 'Private presentation theme')
})

describe('analysis log hygiene integration', () => {
  it('never logs sensitive analysis payloads', async () => {
    prepareSession('00000000-0000-0000-0000-000000000011')
    await harness.container.useCases.processSessionAudio.execute({
      sessionId: '00000000-0000-0000-0000-000000000011',
    })

    prepareSession('00000000-0000-0000-0000-000000000012')
    harness.transcription.failNext(new TranscriptionFailedError('provider unavailable'))
    await expect(
      harness.container.useCases.processSessionAudio.execute({
        sessionId: '00000000-0000-0000-0000-000000000012',
      }),
    ).rejects.toMatchObject({ code: 'analyses.TRANSCRIPTION_FAILED' })

    prepareSession('00000000-0000-0000-0000-000000000013')
    harness.clock.set(new Date(ANALYSES_TEST_NOW.getTime() + 300_001))
    await expect(
      harness.container.useCases.processSessionAudio.execute({
        sessionId: '00000000-0000-0000-0000-000000000013',
      }),
    ).rejects.toMatchObject({ code: 'analyses.ANALYSIS_DEADLINE_EXCEEDED' })

    const logs = JSON.stringify(harness.logger.messages)
    for (const forbidden of [
      'Transcript',
      'private audio',
      'DEEPGRAM_API_KEY',
      'google credential',
      'signed-url',
      'Bearer token',
    ]) {
      expect(logs).not.toContain(forbidden)
    }
  })
})

function prepareSession(sessionId: string): void {
  harness.sessions.setContext({
    sessionId,
    accountId: ACCOUNT_ID,
    themeId: THEME_ID,
    audioPath: 'signed-url/private-audio',
    recordedAt: ANALYSES_TEST_NOW,
  })
  harness.audioReader.setAudio(sessionId, Buffer.from('private audio'))
  harness.clock.set(ANALYSES_TEST_NOW)
}
