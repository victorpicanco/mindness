'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  readonly children: ReactNode
  readonly description: string
  readonly onClose: () => void
  readonly open: boolean
  readonly title: string
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({ children, description, onClose, open, title }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return

    const dialog = dialogRef.current
    if (dialog === null) return
    const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    const firstFocusableElement = focusableElements[0]
    const lastFocusableElement = focusableElements.at(-1)

    firstFocusableElement?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (
        event.key !== 'Tab' ||
        firstFocusableElement === undefined ||
        lastFocusableElement === undefined
      ) {
        return
      }

      if (event.shiftKey && document.activeElement === firstFocusableElement) {
        event.preventDefault()
        lastFocusableElement.focus()
      }

      if (!event.shiftKey && document.activeElement === lastFocusableElement) {
        event.preventDefault()
        firstFocusableElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-60 grid place-items-center p-4">
      <button
        aria-label={title}
        className="absolute inset-0 cursor-pointer bg-text/30 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-10 flex w-full max-w-md flex-col gap-4 rounded-2xl border border-divider bg-surface p-6 shadow-xl"
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex flex-col gap-2">
          <h2 className="font-(family-name:--font-buenard) text-2xl text-text" id={titleId}>
            {title}
          </h2>
          <p className="text-sm text-text-muted" id={descriptionId}>
            {description}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{children}</div>
      </div>
    </div>
  )
}
