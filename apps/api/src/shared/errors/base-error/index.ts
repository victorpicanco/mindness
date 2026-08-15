export interface ErrorContext {
  readonly [key: string]: unknown
}

export interface BaseErrorOptions {
  readonly context?: ErrorContext
  readonly cause?: unknown
}

export abstract class BaseError extends Error {
  abstract readonly code: string
  abstract readonly httpStatus: number
  readonly context: ErrorContext
  override readonly cause?: unknown

  constructor(message: string, options?: BaseErrorOptions) {
    super(message)
    this.name = this.constructor.name
    this.context = options?.context ?? {}
    this.cause = options?.cause
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
