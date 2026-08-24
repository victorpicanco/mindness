'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

export function ToastTrigger() {
  const t = useTranslations('home.feedback.toasts')

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => toast.info(t('info.message'))} variant="secondary">
        {t('info.button')}
      </Button>
      <Button onClick={() => toast.success(t('success.message'))}>{t('success.button')}</Button>
      <Button onClick={() => toast.warning(t('warning.message'))} variant="secondary">
        {t('warning.button')}
      </Button>
      <Button onClick={() => toast.error(t('error.message'))} variant="destructive">
        {t('error.button')}
      </Button>
    </div>
  )
}
