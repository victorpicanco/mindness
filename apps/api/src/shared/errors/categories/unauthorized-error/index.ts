import { ApplicationError } from '@/shared/errors/application-error/index.js'

export abstract class UnauthorizedError extends ApplicationError {
  readonly httpStatus = 401
}
