import { passwordRequirements, type PasswordRequirementKey } from '../password-policy'

type PasswordRequirementLabels = {
  readonly [Key in PasswordRequirementKey]: string
}

type PasswordChecklistProps = {
  readonly labels: PasswordRequirementLabels
  readonly password: string
  readonly title: string
}

export function PasswordChecklist({ labels, password, title }: PasswordChecklistProps) {
  return (
    <ul aria-label={title} className="grid gap-1.5 text-sm">
      {passwordRequirements.map((requirement) => {
        const isSatisfied = requirement.isSatisfied(password)
        const iconClassName = isSatisfied
          ? 'hgi hgi-stroke hgi-checkmark-circle-02 text-success'
          : 'hgi hgi-stroke hgi-circle text-text-muted'

        return (
          <li
            className={
              isSatisfied
                ? 'flex items-center gap-2 text-text'
                : 'flex items-center gap-2 text-text-muted'
            }
            data-satisfied={isSatisfied}
            key={requirement.key}
          >
            <i aria-hidden="true" className={iconClassName} />
            {labels[requirement.key]}
          </li>
        )
      })}
    </ul>
  )
}
