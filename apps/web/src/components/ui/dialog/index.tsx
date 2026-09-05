'use client'

import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react'

type DialogProps = {
  readonly children: ReactNode
  readonly description: string
  readonly onClose: () => void
  readonly open: boolean
  readonly title: string
}

export function Dialog({ children, description, onClose, open, title }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function closeFromBackdrop(event: PointerEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-divider bg-surface p-6 text-text shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-[1px] dark:backdrop:bg-black/60"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onPointerDown={closeFromBackdrop}
      ref={dialogRef}
    >
      <div className="flex flex-col gap-4">
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
    </dialog>
  )
}
