'use client'

import { motion } from 'motion/react'
import { Fragment } from 'react'

const REVEAL_DURATION_SECONDS = 0.48
const REVEAL_EASE = [0.22, 1, 0.36, 1] as const

interface SplitTextProps {
  readonly className?: string
  readonly delay?: number
  readonly text: string
}

interface TextSegment {
  readonly order: number
  readonly value: string
}
function segmentsOf(text: string): readonly TextSegment[] {
  let order = 0

  return text.split(/(\s+)/u).map((value, index) => ({
    order: index % 2 === 0 && value !== '' ? order++ : -1,
    value,
  }))
}
export function SplitText({ className, delay = 35, text }: SplitTextProps) {
  return (
    <p className={className} data-split-text="words" style={{ textWrap: 'pretty' }}>
      {segmentsOf(text).map((segment, index) =>
        segment.order === -1 ? (
          <Fragment key={index}>{segment.value}</Fragment>
        ) : (
          <motion.span
            animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
            className="mindness-split-word inline-block"
            data-split-word
            initial={{ filter: 'blur(4px)', opacity: 0, y: 10 }}
            key={index}
            transition={{
              delay: (segment.order * delay) / 1_000,
              duration: REVEAL_DURATION_SECONDS,
              ease: REVEAL_EASE,
            }}
          >
            {segment.value}
          </motion.span>
        ),
      )}
    </p>
  )
}
