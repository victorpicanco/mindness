import type { ReactNode } from 'react'

interface SessionMessageProps {
  readonly children: ReactNode
  readonly label: string
  readonly sender: 'assistant' | 'user'
}

export function SessionMessage({ children, label, sender }: SessionMessageProps) {
  if (sender === 'user') {
    return (
      <article aria-label={label} className="flex justify-end">
        <div className="max-w-2xl rounded-3xl bg-input px-4 py-2.5 leading-7">{children}</div>
      </article>
    )
  }

  return (
    <article aria-label={label} className="max-w-3xl leading-7">
      {children}
    </article>
  )
}
