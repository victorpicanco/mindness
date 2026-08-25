import type { IconName } from '@/lib/ui/icon-name'

export interface SidebarNavigationItem {
  readonly href: string
  readonly icon: IconName
  readonly label: string
}
