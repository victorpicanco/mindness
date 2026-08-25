import type { IconName } from '@/lib/ui/icon-name'

export interface SidebarNavigationItem {
  readonly href: string
  readonly icon: IconName
  readonly label: string
}

export interface SidebarSessionItem {
  readonly href: string
  readonly label: string
  readonly sessionId: string
}

export interface SidebarSessionGroup {
  readonly heading: string
  readonly items: readonly SidebarSessionItem[]
  readonly key: string
}
