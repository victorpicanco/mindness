import { createStore } from 'zustand/vanilla'

import { InvalidPracticeSessionTransitionError, type PracticeSessionAction } from './errors'

export type PracticeSessionStatus =
  'idle' | 'researching' | 'countdown-warning' | 'recording' | 'uploading' | 'done' | 'expired'

export interface PracticeSessionState {
  readonly status: PracticeSessionStatus
  readonly audioBlob: Blob | null
  readonly retentionDeadline: number | null
  readonly startResearching: () => void
  readonly beginRecording: () => void
  readonly captureAudio: (audioBlob: Blob) => void
  readonly discardAudio: () => void
  readonly reset: () => void
}

const ALL_STATUSES: readonly PracticeSessionStatus[] = [
  'idle',
  'researching',
  'countdown-warning',
  'recording',
  'uploading',
  'done',
  'expired',
]

const AUDIO_RETENTION_WINDOW_MS = 15 * 60 * 1_000

function assertTransition(
  fromStatus: PracticeSessionStatus,
  attemptedAction: PracticeSessionAction,
  allowedStatuses: readonly PracticeSessionStatus[],
) {
  if (!allowedStatuses.includes(fromStatus)) {
    throw new InvalidPracticeSessionTransitionError(fromStatus, attemptedAction)
  }
}

export function createPracticeSessionStore() {
  let retentionTimer: ReturnType<typeof setTimeout> | null = null

  function clearRetentionTimer() {
    if (retentionTimer !== null) {
      clearTimeout(retentionTimer)
      retentionTimer = null
    }
  }

  return createStore<PracticeSessionState>()((set) => ({
    status: 'idle',
    audioBlob: null,
    retentionDeadline: null,
    startResearching: () => {
      set((state) => {
        assertTransition(state.status, 'startResearching', ['idle'])
        return { status: 'researching' }
      })
    },
    beginRecording: () => {
      set((state) => {
        assertTransition(state.status, 'beginRecording', ['researching', 'countdown-warning'])
        return { status: 'recording' }
      })
    },
    captureAudio: (audioBlob) => {
      const retentionDeadline = Date.now() + AUDIO_RETENTION_WINDOW_MS

      set((state) => {
        assertTransition(state.status, 'captureAudio', ['recording'])
        return { audioBlob, retentionDeadline, status: 'uploading' }
      })

      clearRetentionTimer()
      retentionTimer = setTimeout(() => {
        retentionTimer = null
        set((state) => {
          if (state.status !== 'uploading' || state.audioBlob !== audioBlob) {
            return state
          }

          return { audioBlob: null, retentionDeadline: null, status: 'expired' }
        })
      }, AUDIO_RETENTION_WINDOW_MS)
    },
    discardAudio: () => {
      set((state) => {
        assertTransition(state.status, 'discardAudio', ['uploading'])
        return { audioBlob: null, retentionDeadline: null, status: 'recording' }
      })
      clearRetentionTimer()
    },
    reset: () => {
      set((state) => {
        assertTransition(state.status, 'reset', ALL_STATUSES)
        return { audioBlob: null, retentionDeadline: null, status: 'idle' }
      })
      clearRetentionTimer()
    },
  }))
}

export type PracticeSessionStoreApi = ReturnType<typeof createPracticeSessionStore>
