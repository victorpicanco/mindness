import { AudioSizeRejectedError } from '@/modules/sessions/domain/errors/audio-size-rejected-error/index.js'
import { AudioUploadFailedError } from '@/modules/sessions/domain/errors/audio-upload-failed-error/index.js'
import { AudioValidationRejectedError } from '@/modules/sessions/domain/errors/audio-validation-rejected-error/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import { RecordingSubmitted } from '@/modules/sessions/domain/events/recording-submitted/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'

import type { ConfirmAudioUploadDependencies, ConfirmAudioUploadInput } from './types.js'

const MAX_SIZE_BYTES = 25 * 1024 * 1024
const MAX_DURATION_SECONDS = 60

function audioPath(accountId: string, sessionId: string): string {
  return `${accountId}/${sessionId}/audio`
}

export class ConfirmAudioUploadUseCase {
  constructor(private readonly dependencies: ConfirmAudioUploadDependencies) {}

  async execute(input: ConfirmAudioUploadInput): Promise<void> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.accountId !== input.accountId) {
      throw new SessionNotFoundError(input.sessionId)
    }

    const path = audioPath(input.accountId, input.sessionId)
    if (session.state !== 'in_progress') {
      await this.removeBestEffort(path)
      throw new SessionNotInProgressError(session.state)
    }

    const sizeBytes = await this.dependencies.audioStorage.getObjectSize(path)
    if (sizeBytes === null) throw new AudioUploadFailedError(path)
    if (sizeBytes > MAX_SIZE_BYTES) {
      await this.dependencies.audioStorage.removeObject(path)
      throw new AudioSizeRejectedError(sizeBytes)
    }

    const audio = await this.dependencies.audioValidation.validate({
      buffer: await this.dependencies.audioStorage.downloadObject(path),
    })
    if (!audio.ok || audio.durationSeconds <= 0 || audio.durationSeconds > MAX_DURATION_SECONDS) {
      await this.dependencies.audioStorage.removeObject(path)
      throw new AudioValidationRejectedError(path)
    }

    const sessionAudio = SessionAudio.create({
      durationSeconds: audio.durationSeconds,
      sizeBytes,
      contentType: audio.contentType,
      storagePath: path,
    })
    const occurredAt = this.dependencies.clock.now()

    await this.dependencies.unitOfWork.run(async () => {
      session.acceptAudio(sessionAudio)
      await this.dependencies.sessions.save(session)
      await this.dependencies.eventPublisher.publish(
        RecordingSubmitted.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt,
          sessionId: session.id,
          accountId: session.accountId,
          durationSeconds: sessionAudio.durationSeconds,
        }),
      )
    })
  }

  private async removeBestEffort(path: string): Promise<void> {
    try {
      await this.dependencies.audioStorage.removeObject(path)
    } catch {
      return
    }
  }
}

export type { ConfirmAudioUploadDependencies, ConfirmAudioUploadInput } from './types.js'
