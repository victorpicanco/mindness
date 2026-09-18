import { createStore } from 'zustand/vanilla'

export type AlertDialogAction = {
  readonly label: string
  readonly onSelect: () => void
}

export type AlertDialogRequest = {
  readonly actions?: readonly AlertDialogAction[] | undefined
  readonly description: string
  readonly title: string
}

type AlertDialogState = {
  readonly dismiss: () => void
  readonly request: AlertDialogRequest | null
  readonly show: (request: AlertDialogRequest) => void
}

export const alertDialogStore = createStore<AlertDialogState>((set) => ({
  dismiss: () => {
    set({ request: null })
  },
  request: null,
  show: (request) => {
    set({ request })
  },
}))

export function showAlertDialog(request: AlertDialogRequest): void {
  alertDialogStore.getState().show(request)
}

export function dismissAlertDialog(): void {
  alertDialogStore.getState().dismiss()
}
