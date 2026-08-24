import { describe, expect, it } from 'vitest'

import { describeApiFieldIssues } from './api-field-issues'

describe('describeApiFieldIssues', () => {
  it('returns no field message when the API reported no issues', () => {
    expect(describeApiFieldIssues(null)).toEqual({})
  })

  it('translates a known field into the localized message key of that field', () => {
    const issues = [{ field: 'email', message: 'must match format "email"' }]

    expect(describeApiFieldIssues(issues)).toEqual({ email: 'auth.errors.invalidEmail' })
  })

  it('describes every known field the API rejected', () => {
    const issues = [
      { field: 'password', message: 'must NOT have fewer than 8 characters' },
      { field: 'captchaToken', message: 'must NOT have fewer than 1 characters' },
    ]

    expect(describeApiFieldIssues(issues)).toEqual({
      password: 'auth.errors.invalidPassword',
      captchaToken: 'auth.errors.captchaRequired',
    })
  })

  it('ignores a field the form does not render', () => {
    const issues = [{ field: 'timeZone', message: 'must NOT have fewer than 1 characters' }]

    expect(describeApiFieldIssues(issues)).toEqual({})
  })

  it('never surfaces the untranslated message the API sent', () => {
    const issues = [{ field: 'email', message: 'must match format "email"' }]

    expect(Object.values(describeApiFieldIssues(issues))).not.toContain('must match format "email"')
  })
})
