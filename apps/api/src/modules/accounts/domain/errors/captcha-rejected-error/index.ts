import { ValidationError } from '@/shared/errors/categories/validation-error/index.js'

export class CaptchaRejectedError extends ValidationError {
  readonly code = 'accounts.CAPTCHA_REJECTED'

  constructor(options?: { cause?: unknown }) {
    super('Captcha verification was rejected', { cause: options?.cause })
  }
}
