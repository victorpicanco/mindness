'use client'

import { Toaster } from 'sonner'
import { useTranslations } from 'next-intl'

import { useTheme } from '@/components/providers/theme-provider'

export function ToastProvider() {
  const t = useTranslations('common.toasts')
  const { theme } = useTheme()

  return (
    <Toaster
      closeButton
      containerAriaLabel={t('label')}
      duration={5000}
      gap={12}
      mobileOffset={{ top: 16, right: 16, left: 16 }}
      offset={{ top: 16, right: 16 }}
      position="top-right"
      richColors
      theme={theme}
      toastOptions={{
        classNames: {
          closeButton: 'mindness-toast-close',
          error: 'mindness-toast-error',
          info: 'mindness-toast-info',
          success: 'mindness-toast-success',
          title: 'mindness-toast-title',
          toast: 'mindness-toast',
          warning: 'mindness-toast-warning',
        },
      }}
      visibleToasts={3}
    />
  )
}
