import { cloneElement, type AriaAttributes, type ReactElement, useId } from 'react'

type FieldControlProps = Pick<AriaAttributes, 'aria-describedby' | 'aria-invalid'> & {
  id?: string
}

type FieldProps = {
  children: ReactElement<FieldControlProps>
  description?: string
  error?: string
  label: string
}

export function Field({ children, description, error, label }: FieldProps) {
  const inputId = useId()
  const descriptionId = description === undefined ? undefined : `${inputId}-description`
  const errorId = error === undefined ? undefined : `${inputId}-error`
  const describedBy = [descriptionId, errorId]
    .filter((value): value is string => value !== undefined)
    .join(' ')

  return (
    <div className="grid gap-1.5">
      <label className="font-sans text-sm font-medium text-text" htmlFor={inputId}>
        {label}
      </label>
      {cloneElement(children, {
        'aria-describedby': describedBy === '' ? undefined : describedBy,
        'aria-invalid': error !== undefined || undefined,
        id: inputId,
      })}
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
