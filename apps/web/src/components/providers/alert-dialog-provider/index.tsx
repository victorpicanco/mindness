'use client'

import { useTranslations } from 'next-intl'
import { useStore } from 'zustand'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { alertDialogStore, dismissAlertDialog } from '@/lib/feedback/alert-dialog'

const noop = () => undefined

export function AlertDialogProvider() {
  const t = useTranslations('common.alerts')
  const request = useStore(alertDialogStore, (state) => state.request)

  if (request === null) return null

  const actions = request.actions ?? []

  return (
    <Dialog
      description={request.description}
      onClose={actions.length === 0 ? dismissAlertDialog : noop}
      open
      title={request.title}
    >
      {actions.length === 0 ? (
        <Button onClick={dismissAlertDialog} type="button">
          {t('dismiss')}
        </Button>
      ) : (
        actions.map((action, index) => (
          <Button
            key={action.label}
            onClick={() => {
              dismissAlertDialog()
              action.onSelect()
            }}
            type="button"
            variant={index === actions.length - 1 ? undefined : 'secondary'}
          >
            {action.label}
          </Button>
        ))
      )}
    </Dialog>
  )
}
