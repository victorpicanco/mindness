import { ApplicationError } from '@/shared/errors/application-error/index.js'

export class OperationFailedError extends ApplicationError {
  readonly code = 'shared.OPERATION_FAILED'
  readonly httpStatus = 500
}
