import { createStore } from 'zustand/vanilla'

import { InvalidPracticeSessionTransitionError, type PracticeSessionAction } from './errors'

export type PracticeSessionStatus =
  'idle' | 'researching' | 'countdown-warning' | 'recording' | 'uploading' | 'done'

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
]

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
      set((state) => {
        assertTransition(state.status, 'captureAudio', ['recording'])
        return { audioBlob, status: 'uploading' }
      })
    },
    discardAudio: () => {
      set((state) => {
        assertTransition(state.status, 'discardAudio', ['uploading'])
        return { audioBlob: null, retentionDeadline: null, status: 'recording' }
      })
    },
    reset: () => {
      set((state) => {
        assertTransition(state.status, 'reset', ALL_STATUSES)
        return { audioBlob: null, retentionDeadline: null, status: 'idle' }
      })
    },
  }))
}

export type PracticeSessionStoreApi = ReturnType<typeof createPracticeSessionStore>
