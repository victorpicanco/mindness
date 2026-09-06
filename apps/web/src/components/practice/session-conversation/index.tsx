'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { z } from 'zod'

import type { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'
import { humanizeSlug } from '@/lib/text/humanize-slug'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { AnalysisPlaybackProvider } from '@/components/practice/analysis-playback'
import { AnalysisMessage } from '@/components/practice/analysis-message'
import { ProcessingStatus } from '@/components/practice/processing-status'
import { RecordedAudioMessage } from '@/components/practice/recorded-audio-message'
import { RecordingStart } from '@/components/practice/recording-start'
import { ResearchTimer } from '@/components/practice/research-timer'
import { SessionMessage } from '@/components/practice/session-message'

type SessionAnalysis = z.output<typeof sessionAnalysisSchema>

interface SessionConversationProps {
  readonly analysis?: SessionAnalysis
}

export function SessionConversation({ analysis }: SessionConversationProps) {
  const t = useTranslations('home.conversation')
  const format = useFormatter()
  const activeSession = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)
  // The store is reset the moment the analysis lands, so the conversation keeps the session it
  // opened with: without this the whole transcript would unmount right as the reply arrives.
  const [session] = useState(activeSession)
  const shouldReduceMotion = useReducedMotion()

  if (session === null) return null

  const researchFinished = status !== 'researching' && status !== 'countdown-warning'
  const hasAudioMessage =
    status === 'uploading' ||
    status === 'processing' ||
    status === 'done' ||
    (status === 'idle' && session.recordingStartedAt !== null)
  const reduceMotion = shouldReduceMotion !== false
  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
  const exit = reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }
  const transition = {
    duration: reduceMotion ? 0 : 0.28,
    ease: [0.22, 1, 0.36, 1] as const,
  }

  return (
    <AnalysisPlaybackProvider>
      <section aria-label={t('label')} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            <SessionMessage label={t('userMessageLabel')} sender="user">
              <p>
                {t('configuration', {
                  category: humanizeSlug(session.configuration.categorySlug),
                  difficulty: t(`difficulties.${session.configuration.difficulty}`),
                  minutes: session.configuration.searchWindowMinutes,
                })}
              </p>
            </SessionMessage>

            <SessionMessage label={t('assistantMessageLabel')} sender="assistant">
              <p className="text-sm text-text-muted">{t('themeIntroduction')}</p>
              <ResearchTimer />
              <p className="mt-3 text-sm leading-6 text-text-muted">{t('researchInstructions')}</p>
            </SessionMessage>

            <AnimatePresence initial={false}>
              {researchFinished ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  exit={exit}
                  initial={enter}
                  key="research-finished"
                  layout="position"
                  transition={transition}
                >
                  <SessionMessage label={t('assistantMessageLabel')} sender="assistant">
                    {status === 'expired' ? (
                      <p role="alert">{t('expired')}</p>
                    ) : (
                      <div aria-live="polite">
                        <p className="font-medium">{t('researchFinished')}</p>
                        <p className="mt-1 text-sm text-text-muted">
                          {t('recordUntil', {
                            time: format.dateTime(new Date(session.expiresAt), {
                              hour: '2-digit',
                              hour12: false,
                              minute: '2-digit',
                            }),
                          })}
                        </p>
                      </div>
                    )}
                  </SessionMessage>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {hasAudioMessage ? (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    initial={enter}
                    key="recorded-audio"
                    layout="position"
                    transition={transition}
                  >
                    <RecordedAudioMessage label={t('userMessageLabel')} />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <ProcessingStatus holdUntilResponse={analysis === undefined} />
            </div>

            <AnimatePresence initial={false}>
              {analysis === undefined ? null : (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  initial={enter}
                  key="analysis"
                  layout="position"
                  transition={transition}
                >
                  <AnalysisMessage analysis={analysis} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="border-t border-divider bg-surface/95 px-4 py-4 backdrop-blur-sm sm:px-8">
          <div className="mx-auto w-full max-w-3xl">
            <RecordingStart />
          </div>
        </div>
      </section>
    </AnalysisPlaybackProvider>
  )
}
