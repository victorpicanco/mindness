'use client'

import type { FocusEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/ui/class-names'

interface AccountMenuProps {
  readonly helpItems: readonly string[]
  readonly helpLabel: string
  readonly isExpanded: boolean
  readonly name: string
  readonly plan: string
  readonly popupLabel: string
  readonly settingsLabel: string
  readonly signOut: () => void | Promise<void>
  readonly signOutLabel: string
}

interface AccountMenuPosition {
  readonly bottom: number
  readonly left: number
}

const POPUP_GAP_IN_PIXELS = 8
const VIEWPORT_INSET_IN_PIXELS = 12

export function AccountMenu({
  helpItems,
  helpLabel,
  isExpanded,
  name,
  plan,
  popupLabel,
  settingsLabel,
  signOut,
  signOutLabel,
}: AccountMenuProps) {
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [position, setPosition] = useState<AccountMenuPosition | null>(null)
  const popupId = useId()
  const popupRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isOpen = position !== null
  const initial = name.slice(0, 1).toLocaleUpperCase()

  useEffect(() => {
    if (!isOpen) return

    popupRef.current?.focus()

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      setPosition(null)
      triggerRef.current?.focus()
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target

      if (!(target instanceof Node)) return
      if (popupRef.current?.contains(target) === true) return
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

  function togglePopup() {
    if (isOpen) {
      setPosition(null)

      return
    }

    const trigger = triggerRef.current

    if (trigger === null) return

    const anchor = trigger.getBoundingClientRect()
    setPosition({
      bottom: window.innerHeight - anchor.top + POPUP_GAP_IN_PIXELS,
      left: Math.max(VIEWPORT_INSET_IN_PIXELS, anchor.left),
    })
  }

  function closeHelpWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return

    setIsHelpOpen(false)
  }

  return (
    <div className="mt-1 pt-1">
      <button
        aria-controls={popupId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={popupLabel}
        className={cn(
          'flex h-13 w-full cursor-pointer items-center gap-2 rounded-xl p-2 text-left text-text transition-colors hover:bg-input focus-visible:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text',
          isExpanded ? '' : 'justify-center',
        )}
        onClick={togglePopup}
        ref={triggerRef}
        type="button"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-text text-sm font-medium text-surface">
          {initial}
        </span>
        {isExpanded ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-text-muted">{plan}</span>
          </span>
        ) : null}
      </button>

      {position === null
        ? null
        : createPortal(
            <div
              aria-label={popupLabel}
              className="fixed z-50 w-60 rounded-2xl border border-divider bg-surface p-2 shadow-xl outline-none"
              id={popupId}
              ref={popupRef}
              role="dialog"
              style={position}
              tabIndex={-1}
            >
              <div className="flex items-center gap-2 px-2 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-text text-xs font-medium text-surface">
                  {initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{name}</span>
                  <span className="block truncate text-xs text-text-muted">{plan}</span>
                </span>
                <Icon className="text-base" name="arrow-right-01" />
              </div>

              <div className="my-1 border-t border-divider" />

              <button
                className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left text-sm text-text transition-colors hover:bg-input focus-visible:bg-input focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
                type="button"
              >
                <Icon className="text-lg" name="settings-01" />
                {settingsLabel}
              </button>

              <div
                className="relative"
                onBlur={closeHelpWhenFocusLeaves}
                onFocus={() => setIsHelpOpen(true)}
                onMouseEnter={() => setIsHelpOpen(true)}
                onMouseLeave={() => setIsHelpOpen(false)}
              >
                <button
                  aria-expanded={isHelpOpen}
                  aria-haspopup="menu"
                  className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left text-sm text-text transition-colors hover:bg-input focus-visible:bg-input focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
                  onClick={() => setIsHelpOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <Icon className="text-lg" name="help-circle" />
                  <span className="flex-1">{helpLabel}</span>
                  <Icon className="text-base" name="arrow-right-01" />
                </button>

                <div
                  className={cn(
                    'absolute bottom-0 left-full z-10 ml-2 w-60 rounded-2xl border border-divider bg-surface p-2 shadow-xl transition-opacity motion-reduce:transition-none',
                    isHelpOpen
                      ? 'pointer-events-auto opacity-100'
                      : 'pointer-events-none opacity-0',
                  )}
                  role="menu"
                >
                  {helpItems.map((item) => (
                    <button
                      className="flex h-10 w-full cursor-pointer items-center rounded-xl px-2 text-left text-sm text-text transition-colors hover:bg-input focus-visible:bg-input focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
                      key={item}
                      role="menuitem"
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="my-1 border-t border-divider" />

              <form action={signOut}>
                <button
                  className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left text-sm text-text transition-colors hover:bg-input focus-visible:bg-input focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
                  type="submit"
                >
                  <Icon className="text-lg" name="logout-01" />
                  {signOutLabel}
                </button>
              </form>
            </div>,
            document.body,
          )}
    </div>
  )
}
