'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { showAlertDialog } from '@/lib/feedback/alert-dialog'

export function ExpiredRecoveryLink() {
  const t = useTranslations('auth.updatePassword')
  const alerts = useTranslations('common.alerts')
  const router = useRouter()

  useEffect(() => {
    showAlertDialog({
      actions: [
        {
          label: t('requestAgain'),
          onSelect: () => {
            router.push('/auth/password-recovery')
          },
        },
      ],
      description: t('invalid'),
      title: alerts('failureTitle'),
    })
  }, [alerts, router, t])

  return null
}
