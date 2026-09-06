'use client'

import { createContext, useContext, useId, type ReactNode } from 'react'

interface FieldControl {
  readonly 'aria-describedby': string | undefined
  readonly 'aria-invalid': true | undefined
  readonly id: string
}

const FieldContext = createContext<FieldControl | null>(null)
export function useFieldControl(): Partial<FieldControl> {
  return useContext(FieldContext) ?? {}
}

interface FieldProps {
  readonly children: ReactNode
  readonly description?: string | undefined
  readonly error?: string | undefined
  readonly label: string
}

export function Field({ children, description, error, label }: FieldProps) {
  const inputId = useId()
  const descriptionId = description === undefined ? undefined : `${inputId}-description`
  const errorId = error === undefined ? undefined : `${inputId}-error`
  const describedBy = [descriptionId, errorId].filter((value) => value !== undefined).join(' ')

  return (
    <div className="grid gap-1.5">
      <label className="font-sans text-sm font-medium text-text" htmlFor={inputId}>
        {label}
      </label>
      <FieldContext.Provider
        value={{
          'aria-describedby': describedBy === '' ? undefined : describedBy,
          'aria-invalid': error === undefined ? undefined : true,
          id: inputId,
        }}
      >
        {children}
      </FieldContext.Provider>
      {description === undefined ? null : (
        <p className="font-sans text-sm text-text-muted" id={descriptionId}>
          {description}
        </p>
      )}
      {error === undefined ? null : (
        <p className="font-sans text-sm text-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
