interface NamedAccount {
  readonly email: string
  readonly name: string | null
}

export function accountDisplayName({ email, name }: NamedAccount): string {
  if (name !== null) return name

  const [localPart] = email.split('@')

  return localPart ?? email
}
