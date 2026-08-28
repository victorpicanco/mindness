'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon, type IconName } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/ui/class-names'

export interface MenuAction {
  readonly icon?: IconName | undefined
  readonly isDestructive?: boolean | undefined
  readonly label: string
  readonly onSelect: () => void
}

interface MenuProps {
  readonly actions: readonly MenuAction[]
  readonly className?: string | undefined
  readonly triggerIcon: IconName
  readonly triggerLabel: string
}

interface MenuPosition {
  readonly left: number
  readonly top: number
}

const MENU_GAP_IN_PIXELS = 4

// The menu is anchored to a trigger inside a scrolling, clipping list, so it is placed in the body
// against the viewport instead of next to the trigger, and closes whenever that anchor may move.
export function Menu({ actions, className, triggerIcon, triggerLabel }: MenuProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerId = useId()
  const menuId = useId()
  const isOpen = position !== null

  useEffect(() => {
    if (!isOpen) return

    const firstAction = menuRef.current?.querySelector('[role="menuitem"]')

    if (firstAction instanceof HTMLElement) firstAction.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      setPosition(null)
      triggerRef.current?.focus()
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target

      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target) === true) return
      if (triggerRef.current?.contains(target) === true) return

      setPosition(null)
    }

    function close() {
      setPosition(null)
    }

    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)

    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [isOpen])

  function toggle() {
    if (isOpen) {
      setPosition(null)

      return
    }

    const trigger = triggerRef.current

    if (trigger === null) return

    const anchor = trigger.getBoundingClientRect()

    setPosition({ left: anchor.right, top: anchor.bottom + MENU_GAP_IN_PIXELS })
  }

  function select(action: MenuAction) {
    setPosition(null)
    triggerRef.current?.focus()
    action.onSelect()
  }

  return (
    <>
      <IconButton
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={className}
        icon={triggerIcon}
        id={triggerId}
        label={triggerLabel}
        onClick={toggle}
        ref={triggerRef}
        size="sm"
      />

      {position === null
        ? null
        : createPortal(
            <div
              aria-labelledby={triggerId}
              className="fixed z-50 min-w-44 -translate-x-full rounded-xl border border-divider bg-surface p-1 shadow-lg"
              id={menuId}
              ref={menuRef}
              role="menu"
              style={{ left: position.left, top: position.top }}
            >
              {actions.map((action) => (
                <button
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-input focus-visible:bg-input focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text',
                    action.isDestructive === true ? 'text-error' : 'text-text',
                  )}
                  key={action.label}
                  onClick={() => select(action)}
                  role="menuitem"
                  type="button"
                >
                  {action.icon === undefined ? null : (
                    <Icon className="text-base" name={action.icon} />
                  )}
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )}
    </>
  )
}
