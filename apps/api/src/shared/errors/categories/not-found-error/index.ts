import { DomainError } from '@/shared/errors/domain-error/index.js'

export abstract class NotFoundError extends DomainError {
  readonly httpStatus = 404
}
