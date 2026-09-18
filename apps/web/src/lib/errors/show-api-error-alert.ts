import type { ApiErrorDetails } from '@/lib/api/api-error'
import { showAlertDialog, type AlertDialogAction } from '@/lib/feedback/alert-dialog'

import { describeApiError, type ApiErrorMessageKey } from './api-error-presentation'

export type AlertTitleKey = 'common.alerts.failureTitle'

export type AlertTranslator = (key: AlertTitleKey | ApiErrorMessageKey) => string

export function showApiErrorAlert(
  error: ApiErrorDetails,
  t: AlertTranslator,
  actions?: readonly AlertDialogAction[],
): void {
  const description = describeApiError(error.code)

  if (description.presentation !== 'dialog') return

  showAlertDialog({
    ...(actions === undefined ? {} : { actions }),
    description: t(description.messageKey),
    title: t('common.alerts.failureTitle'),
  })
}
