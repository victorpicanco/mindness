import { BaseError } from '@/shared/errors/base-error/index.js'

export abstract class InfrastructureError extends BaseError {
  readonly httpStatus: number = 500
}
