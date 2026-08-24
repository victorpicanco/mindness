'use client'

import { Toaster } from 'sonner'
import { useTranslations } from 'next-intl'

export function ToastProvider() {
  const t = useTranslations('common.toasts')

  return <Toaster containerAriaLabel={t('label')} />
}
