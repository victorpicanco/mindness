'use client'

import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react'

type DialogProps = {
  readonly appearance?: 'default' | 'split' | undefined
  readonly children?: ReactNode | undefined
  readonly contentLayout?: 'actions' | 'content' | undefined
  readonly desktopAside?: ReactNode | undefined
  readonly description: string
  readonly onClose: () => void
  readonly open: boolean
  readonly splitContentTestId?: string | undefined
  readonly title: string
}

export function Dialog({
  appearance = 'default',
  children,
  contentLayout = 'actions',
  desktopAside,
  description,
  onClose,
  open,
  splitContentTestId,
  title,
}: DialogProps) {
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
      className={
        appearance === 'split'
          ? 'm-auto min-h-64 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-2xl bg-surface p-0 shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-[1px] dark:backdrop:bg-black/60 lg:grid lg:h-[min(40rem,calc(100dvh-4rem))] lg:max-w-4xl lg:grid-cols-2 lg:min-h-0'
          : 'm-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-divider bg-surface p-6 text-text shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-[1px] dark:backdrop:bg-black/60'
      }
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onPointerDown={closeFromBackdrop}
      ref={dialogRef}
    >
      {appearance === 'split' ? (
        <>
          <aside className="hidden min-h-0 overflow-hidden lg:block">{desktopAside}</aside>
          <div
            className="min-h-64 overflow-y-auto rounded-2xl border border-border bg-surface p-6 text-text lg:min-h-0 lg:overflow-hidden lg:rounded-l-none"
            data-testid={splitContentTestId}
          >
            <div className="sr-only">
              <h2 id={titleId}>{title}</h2>
              <p id={descriptionId}>{description}</p>
            </div>
            <div className="grid min-h-full gap-4 lg:h-full">{children}</div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="font-(family-name:--font-buenard) text-2xl text-text" id={titleId}>
              {title}
            </h2>
            <p className="text-sm text-text-muted" id={descriptionId}>
              {description}
            </p>
          </div>
          <div
            className={
              contentLayout === 'content'
                ? 'grid gap-4'
                : 'flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'
            }
          >
            {children}
          </div>
        </div>
      )}
    </dialog>
  )
}
