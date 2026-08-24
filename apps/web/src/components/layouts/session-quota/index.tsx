'use client'

import { useTranslations } from 'next-intl'

interface SessionQuotaProps {
  readonly allowance: number
  readonly remaining: number
  readonly renewsAt: string
}

function renewalTime(renewsAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  }).format(new Date(renewsAt))
}

export function SessionQuota({ allowance, remaining, renewsAt }: SessionQuotaProps) {
  const t = useTranslations('common.sessionQuota')
  const label =
    remaining === 0
      ? t('renewsAt', { time: renewalTime(renewsAt) })
      : t('remaining', { allowance, remaining })

  return (
    <output
      aria-label={t('label')}
      aria-live="polite"
      className="inline-flex min-h-10 items-center rounded-control border border-border bg-surface-raised px-4 text-sm font-medium tabular-nums text-text shadow-[0_1px_0_rgb(0_0_0_/_0.03)]"
    >
      {label}
    </output>
  )
}
