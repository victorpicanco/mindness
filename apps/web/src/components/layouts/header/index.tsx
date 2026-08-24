import type { ReactNode } from 'react'

interface HeaderProps {
  readonly leftItem?: ReactNode
}

export function Header({ leftItem }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-divider px-3 md:hidden">
      {leftItem}
    </header>
  )
}
