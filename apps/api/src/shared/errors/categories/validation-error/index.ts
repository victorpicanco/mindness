import { ApplicationError } from '@/shared/errors/application-error/index.js'

export abstract class ValidationError extends ApplicationError {
  readonly httpStatus = 400
}
