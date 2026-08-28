import { z } from 'zod'

const MINIMUM_PASSWORD_LENGTH = 8
const MAXIMUM_PASSWORD_LENGTH = 64

export const passwordRequirements = [
  {
    key: 'minimumLength',
    isSatisfied: (password: string): boolean => password.length >= MINIMUM_PASSWORD_LENGTH,
  },
  {
    key: 'lowercaseLetter',
    isSatisfied: (password: string): boolean => /[a-z]/u.test(password),
  },
  {
    key: 'uppercaseLetter',
    isSatisfied: (password: string): boolean => /[A-Z]/u.test(password),
  },
  {
    key: 'digit',
    isSatisfied: (password: string): boolean => /\d/u.test(password),
  },
  {
    key: 'symbol',
    isSatisfied: (password: string): boolean => /[^A-Za-z\d]/u.test(password),
  },
] as const

function meetsPasswordRequirements(password: string): boolean {
  return passwordRequirements.every((requirement) => requirement.isSatisfied(password))
}

export const passwordSchema = z
  .string()
  .max(MAXIMUM_PASSWORD_LENGTH)
  .refine(meetsPasswordRequirements)
