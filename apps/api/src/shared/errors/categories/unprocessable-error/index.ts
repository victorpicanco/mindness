import { DomainError } from '@/shared/errors/domain-error/index.js'

export abstract class UnprocessableError extends DomainError {
  readonly httpStatus = 422
}
