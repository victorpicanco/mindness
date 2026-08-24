'use client'

import { useTranslations } from 'next-intl'

import { VisuallyHidden } from '@/components/ui/visually-hidden'

type SpinnerProps = {
  label?: string
}

export function Spinner({ label }: SpinnerProps) {
  const t = useTranslations('common.loading')
  const accessibleLabel = label ?? t('label')

  return (
    <span
      aria-label={accessibleLabel}
      className="inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
      role="status"
    >
      <VisuallyHidden>{accessibleLabel}</VisuallyHidden>
    </span>
  )
}
