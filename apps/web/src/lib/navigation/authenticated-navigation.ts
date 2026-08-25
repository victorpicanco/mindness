import type { messages } from '@/i18n/messages'
import type { IconName } from '@/lib/ui/icon-name'

type AuthenticatedShellMessages = (typeof messages)['common']['authenticatedShell']

export interface AuthenticatedNavigationItem {
  readonly href: string
  readonly icon: IconName
  readonly labelKey: keyof AuthenticatedShellMessages
}

export const AUTHENTICATED_NAVIGATION_ITEMS = [
  { href: '/', icon: 'pencil-edit-02', labelKey: 'newSession' },
  { href: '/history', icon: 'chart-increase', labelKey: 'progress' },
] as const satisfies readonly AuthenticatedNavigationItem[]
