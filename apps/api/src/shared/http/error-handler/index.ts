import type { FastifyInstance, FastifySchemaValidationError } from 'fastify'

import { BaseError } from '@/shared/errors/base-error/index.js'
import { ValidationError } from '@/shared/errors/categories/validation-error/index.js'
import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'
import type { FieldIssue } from '@/shared/errors/validation-failed-error/index.js'
import type { ErrorEnvelope } from '@/shared/http/envelope/index.js'

const GENERIC_ERROR_CODE = 'shared.INTERNAL_ERROR'
const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred'
const VALIDATION_FAILED_CODE = 'shared.VALIDATION_FAILED'
const VALIDATION_FAILED_MESSAGE = 'Request validation failed'

function isFieldIssue(value: unknown): value is FieldIssue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'field' in value &&
    'message' in value &&
    typeof value.field === 'string' &&
    typeof value.message === 'string'
  )
}

function isFieldIssueArray(value: unknown): value is FieldIssue[] {
  return Array.isArray(value) && value.every(isFieldIssue)
}

function issuesFromContext(error: BaseError): FieldIssue[] | null {
  if (!(error instanceof ValidationError)) return null
  const { issues } = error.context
  return isFieldIssueArray(issues) ? issues : null
}

function isFastifyValidationError(
  error: unknown,
): error is Error & { validation: FastifySchemaValidationError[] } {
  return (
    error instanceof Error &&
    'validation' in error &&
    Array.isArray(error.validation) &&
    error.validation.length > 0
  )
}

function fieldFromValidationError(error: FastifySchemaValidationError): string {
  const path = error.instancePath.replace(/^\//, '').replace(/\//g, '.')
  if (path) return path

  if (error.keyword !== 'required') return ''
  const requiredProperties = error.params.requiredProperties
  if (!Array.isArray(requiredProperties)) return ''
  return typeof requiredProperties[0] === 'string' ? requiredProperties[0] : ''
}

function issuesFromFastifyValidation(errors: FastifySchemaValidationError[]): FieldIssue[] {
  return errors.map((error) => ({
    field: fieldFromValidationError(error),
    message: error.message ?? 'Invalid value',
  }))
}

function buildErrorEnvelope(
  code: string,
  message: string,
  issues: FieldIssue[] | null,
  requestId: string,
): ErrorEnvelope {
  return { error: { code, message, issues, requestId } }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request, reply) => {
    const requestId = request.id

    if (error instanceof BaseError) {
      if (error instanceof InfrastructureError) {
        request.log.error(
          {
            requestId,
            code: error.code,
            context: error.context,
            cause: error.cause,
            stack: error.stack,
            httpStatus: error.httpStatus,
          },
          error.message,
        )
        reply
          .status(500)
          .send(buildErrorEnvelope(GENERIC_ERROR_CODE, GENERIC_ERROR_MESSAGE, null, requestId))
        return
      }

      request.log.warn(
        { requestId, code: error.code, context: error.context, httpStatus: error.httpStatus },
        error.message,
      )
      reply
        .status(error.httpStatus)
        .send(buildErrorEnvelope(error.code, error.message, issuesFromContext(error), requestId))
      return
    }

    if (isFastifyValidationError(error)) {
      const issues = issuesFromFastifyValidation(error.validation)
      request.log.warn(
        { requestId, code: VALIDATION_FAILED_CODE, issues },
        VALIDATION_FAILED_MESSAGE,
      )
      reply
        .status(400)
        .send(
          buildErrorEnvelope(VALIDATION_FAILED_CODE, VALIDATION_FAILED_MESSAGE, issues, requestId),
        )
      return
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : undefined
    request.log.error({ requestId, message, stack }, 'Unhandled error')
    reply
      .status(500)
      .send(buildErrorEnvelope(GENERIC_ERROR_CODE, GENERIC_ERROR_MESSAGE, null, requestId))
  })
}
