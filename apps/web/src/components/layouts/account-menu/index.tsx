'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/ui/class-names'

interface AccountMenuProps {
  readonly isExpanded: boolean
  readonly name: string
  readonly onOpenSettings: () => void
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
  isExpanded,
  name,
  onOpenSettings,
  plan,
  popupLabel,
  settingsLabel,
  signOut,
  signOutLabel,
}: AccountMenuProps) {
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

  function openSettings() {
    setPosition(null)
    onOpenSettings()
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
                onClick={openSettings}
                type="button"
              >
                <Icon className="text-lg" name="settings-01" />
                {settingsLabel}
              </button>

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
