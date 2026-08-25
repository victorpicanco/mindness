import { Icon } from '@/components/ui/icon'

import { passwordRequirements, type PasswordRequirementKey } from '@/lib/auth/password-policy'

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
            <Icon
              className={isSatisfied ? 'text-success' : 'text-text-muted'}
              name={isSatisfied ? 'checkmark-circle-02' : 'circle'}
            />
            {labels[requirement.key]}
          </li>
        )
      })}
    </ul>
  )
}
