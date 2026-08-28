'use client'

import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { SplitText as GsapSplitText } from 'gsap/SplitText'
import { useRef } from 'react'

gsap.registerPlugin(GsapSplitText, useGSAP)

type SplitTextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span'

interface SplitTextProps {
  readonly className?: string
  readonly delay?: number
  readonly id?: string
  readonly tag?: SplitTextTag
  readonly text: string
}

export function SplitText({ className, delay = 35, id, tag = 'p', text }: SplitTextProps) {
  const textRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const element = textRef.current

      if (element === null || typeof window.matchMedia !== 'function') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const split = GsapSplitText.create(element, {
        type: 'words',
        wordsClass: 'mindness-split-word',
      })

      gsap.fromTo(
        split.words,
        { autoAlpha: 0, filter: 'blur(4px)', y: 10 },
        {
          autoAlpha: 1,
          duration: 0.48,
          ease: 'power3.out',
          filter: 'blur(0px)',
          stagger: delay / 1_000,
          y: 0,
        },
      )

      return () => split.revert()
    },
    { dependencies: [delay, text], scope: textRef },
  )

  const Tag = tag

  return (
    <Tag
      className={className}
      data-split-text="words"
      id={id}
      ref={(element) => {
        textRef.current = element
      }}
      style={{ textWrap: 'pretty' }}
    >
      {text}
    </Tag>
  )
}
