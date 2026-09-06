'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface PlaybackControls {
  readonly playFrom: (seconds: number) => void
  readonly pause: () => void
}

interface AnalysisPlayback {
  readonly available: boolean
  readonly playingFrom: number | null
  readonly register: (controls: PlaybackControls) => () => void
  readonly reportPlaying: (startSeconds: number | null) => void
  readonly playFrom: (seconds: number) => void
  readonly pause: () => void
}

const PlaybackContext = createContext<AnalysisPlayback | null>(null)

export function AnalysisPlaybackProvider({ children }: { readonly children: ReactNode }) {
  const player = useRef<PlaybackControls | null>(null)
  const [available, setAvailable] = useState(false)
  const [playingFrom, setPlayingFrom] = useState<number | null>(null)
  const register = useCallback((controls: PlaybackControls) => {
    player.current = controls
    setAvailable(true)
    return () => {
      if (player.current === controls) {
        player.current = null
        setAvailable(false)
        setPlayingFrom(null)
      }
    }
  }, [])
  const reportPlaying = useCallback((startSeconds: number | null) => {
    setPlayingFrom(startSeconds)
  }, [])
  const playFrom = useCallback((seconds: number) => {
    if (Number.isFinite(seconds) && seconds >= 0) player.current?.playFrom(seconds)
  }, [])
  const pause = useCallback(() => {
    player.current?.pause()
  }, [])
  const value = useMemo(
    () => ({ available, playingFrom, register, reportPlaying, playFrom, pause }),
    [available, playingFrom, register, reportPlaying, playFrom, pause],
  )
  return <PlaybackContext value={value}>{children}</PlaybackContext>
}

export function useAnalysisPlayback() {
  return useContext(PlaybackContext)
}
