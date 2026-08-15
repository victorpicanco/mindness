import { DomainError } from '@/shared/errors/domain-error/index.js'

export abstract class ConflictError extends DomainError {
  readonly httpStatus = 409
}
