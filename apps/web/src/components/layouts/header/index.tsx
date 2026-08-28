import type { ReactNode } from 'react'

interface HeaderProps {
  readonly leftItem?: ReactNode | undefined
  readonly rightItem?: ReactNode | undefined
}

export function Header({ leftItem, rightItem }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-divider px-3 md:px-6">
      {leftItem === undefined ? null : <div className="md:hidden">{leftItem}</div>}
      {rightItem === undefined ? null : <div className="ml-auto">{rightItem}</div>}
    </header>
  )
}
