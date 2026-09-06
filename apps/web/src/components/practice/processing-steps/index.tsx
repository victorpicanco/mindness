'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { ShinyText } from '@/components/ui/shiny-text'
import { VisuallyHidden } from '@/components/ui/visually-hidden'

export const PROCESSING_STEP_INTERVAL_MS = 2_800

const STEPS = [
  'sending',
  'transcribing',
  'pacing',
  'structure',
  'strengths',
  'improvements',
  'assembling',
] as const

type ProcessingStep = (typeof STEPS)[number]

interface ProcessingStepsProps {
  readonly paused?: boolean
}

export function ProcessingSteps({ paused = false }: ProcessingStepsProps) {
  const t = useTranslations('home.processing')
  const shouldReduceMotion = useReducedMotion()
  const [step, setStep] = useState<ProcessingStep>('sending')

  useEffect(() => {
    const next = STEPS[STEPS.indexOf(step) + 1]
    if (paused || next === undefined) return

    const timer = setTimeout(() => setStep(next), PROCESSING_STEP_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [paused, step])

  const reduceMotion = shouldReduceMotion !== false

  return (
    <p className="min-h-4 text-xs" role="status">
      <VisuallyHidden>{t('waiting')}</VisuallyHidden>
      <motion.span
        animate={{ opacity: 1, y: 0 }}
        aria-hidden="true"
        className="block"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
        key={step}
        transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <ShinyText text={t(`steps.${step}`)} />
      </motion.span>
    </p>
  )
}
