import { useEffect, useState } from 'react'

import { MicrophoneUnavailableError } from '@/lib/media/microphone-unavailable-error'

export const BAR_INTERVAL_MS = 64

const FFT_SIZE = 2048
const BYTE_MIDPOINT = 128

export interface AudioLevelReader {
  readonly read: () => number
  readonly stop: () => void
}

export type AudioLevelSource = () => Promise<AudioLevelReader>

export interface AudioLevels {
  readonly hasFailed: boolean
  readonly levels: readonly number[]
}

export interface UseAudioLevelsOptions {
  readonly historySize: number
  readonly isActive: boolean
  readonly source?: AudioLevelSource
}

export async function browserAudioLevelSource(): Promise<AudioLevelReader> {
  let stream: MediaStream

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (cause) {
    throw new MicrophoneUnavailableError(cause)
  }

  const context = new AudioContext()
  const analyser = context.createAnalyser()

  analyser.fftSize = FFT_SIZE
  context.createMediaStreamSource(stream).connect(analyser)

  const samples = new Uint8Array(analyser.fftSize)

  return {
    read: () => {
      analyser.getByteTimeDomainData(samples)

      let peak = 0

      for (const sample of samples) {
        const amplitude = Math.abs(sample - BYTE_MIDPOINT) / BYTE_MIDPOINT

        if (amplitude > peak) peak = amplitude
      }

      return peak
    },
    stop: () => {
      for (const track of stream.getTracks()) track.stop()

      void context.close()
    },
  }
}

export function useAudioLevels({
  historySize,
  isActive,
  source = browserAudioLevelSource,
}: UseAudioLevelsOptions): AudioLevels {
  const [levels, setLevels] = useState<readonly number[]>([])
  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    if (!isActive) return

    let reader: AudioLevelReader | null = null
    let frame = 0
    let isCancelled = false
    let peak = 0
    let barStartedAt: number | null = null

    function sample(timestamp: number) {
      frame = window.requestAnimationFrame(sample)

      if (reader === null) return

      peak = Math.max(peak, reader.read())

      if (barStartedAt === null) {
        barStartedAt = timestamp

        return
      }

      if (timestamp - barStartedAt < BAR_INTERVAL_MS) return

      const bar = peak

      barStartedAt = timestamp
      peak = 0
      setLevels((current) => [...current, bar].slice(-historySize))
    }

    void source()
      .then((opened) => {
        if (isCancelled) {
          opened.stop()

          return
        }

        reader = opened
        frame = window.requestAnimationFrame(sample)
      })
      .catch(() => {
        setHasFailed(true)
      })

    return () => {
      isCancelled = true
      window.cancelAnimationFrame(frame)
      reader?.stop()
      reader = null
      setLevels([])
      setHasFailed(false)
    }
  }, [historySize, isActive, source])

  return { hasFailed, levels }
}
