import { ApplicationError } from '@/shared/errors/application-error/index.js'

export abstract class TooManyRequestsError extends ApplicationError {
  readonly httpStatus = 429
}
