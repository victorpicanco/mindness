import { ApplicationError } from '@/shared/errors/application-error/index.js'

export abstract class ForbiddenError extends ApplicationError {
  readonly httpStatus = 403
}
