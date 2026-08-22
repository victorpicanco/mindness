import { AudioSizeRejectedError } from '@/modules/sessions/domain/errors/audio-size-rejected-error/index.js'
import { AudioUploadFailedError } from '@/modules/sessions/domain/errors/audio-upload-failed-error/index.js'
import { AudioValidationRejectedError } from '@/modules/sessions/domain/errors/audio-validation-rejected-error/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import { RecordingSubmitted } from '@/modules/sessions/domain/events/recording-submitted/index.js'
import { AudioObjectPath } from '@/modules/sessions/domain/value-objects/audio-object-path/index.js'
import {
  MAX_AUDIO_DURATION_SECONDS,
  MAX_AUDIO_SIZE_BYTES,
  SessionAudio,
} from '@/modules/sessions/domain/value-objects/session-audio/index.js'

import type { ConfirmAudioUploadDependencies, ConfirmAudioUploadInput } from './types.js'

export class ConfirmAudioUploadUseCase {
  constructor(private readonly dependencies: ConfirmAudioUploadDependencies) {}

  async execute(input: ConfirmAudioUploadInput): Promise<void> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.accountId !== input.accountId) {
      throw new SessionNotFoundError(input.sessionId)
    }

    const path = AudioObjectPath.forSession({
      accountId: input.accountId,
      sessionId: input.sessionId,
    }).value
    const now = this.dependencies.clock.now()

    // D-09: an upload that lands after the deadline is an orphan, not a submission — the
    // object goes before the caller learns the session is over.
    if (!session.isLiveAt(now)) {
      await this.removeBestEffort(path)
      throw new SessionNotInProgressError(session.hasElapsedAt(now) ? 'expired' : session.state)
    }

    // Checked before downloading so a hostile object of arbitrary size is never pulled in.
    const sizeBytes = await this.dependencies.audioStorage.getObjectSize(path)
    if (sizeBytes === null || sizeBytes === 0) throw new AudioUploadFailedError(path)
    if (sizeBytes > MAX_AUDIO_SIZE_BYTES) {
      await this.dependencies.audioStorage.removeObject(path)
      throw new AudioSizeRejectedError(sizeBytes)
    }

    const validation = await this.dependencies.audioValidation.validate({
      buffer: await this.dependencies.audioStorage.downloadObject(path),
    })
    // The decoder only reports what it observed (D-08); the duration limit is decided here.
    const withinDomainLimits =
      validation.ok &&
      validation.durationSeconds > 0 &&
      validation.durationSeconds <= MAX_AUDIO_DURATION_SECONDS
    if (!withinDomainLimits) {
      await this.dependencies.audioStorage.removeObject(path)
      throw new AudioValidationRejectedError(path)
    }

    const audio = SessionAudio.create({
      id: this.dependencies.idGenerator.generate(),
      durationSeconds: validation.durationSeconds,
      sizeBytes,
      contentType: validation.contentType,
      storagePath: path,
    })

    await this.dependencies.unitOfWork.run(async () => {
      session.acceptAudio(audio, now)
      await this.dependencies.sessions.save(session)
    })

    // The subscriber of this event enqueues the analysis job, which is network I/O against
    // Redis: inside the transaction it would hold a Serializable transaction open for the
    // whole round trip, and would fire for a transaction that still might roll back.
    await this.dependencies.eventPublisher.publish(
      RecordingSubmitted.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: now,
        sessionId: session.id,
        accountId: session.accountId,
        durationSeconds: audio.durationSeconds,
      }),
    )
  }

  // A-12: removing the orphan is best effort by design — the caller must still see why the
  // confirmation failed, never an infrastructure error from the cleanup.
  private async removeBestEffort(path: string): Promise<void> {
    try {
      await this.dependencies.audioStorage.removeObject(path)
    } catch {
      return
    }
  }
}

export type { ConfirmAudioUploadDependencies, ConfirmAudioUploadInput } from './types.js'
