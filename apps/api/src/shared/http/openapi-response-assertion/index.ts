import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import type { FastifyInstance } from 'fastify'

import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readPath(value: unknown, path: readonly (string | number)[]): unknown {
  let current = value

  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }

  return current
}

// ajv-formats ships CommonJS, so the callable plugin sits behind `.default` under NodeNext.
function buildValidator(): Ajv {
  return addFormats.default(new Ajv({ strict: false, allErrors: true }))
}

export interface InjectedResponse {
  json(): unknown
}

const validators = new WeakMap<FastifyInstance, Ajv>()

// LAW-011.13: the OpenAPI document the frontend consumes is the contract, so every response is
// re-validated against the schema the route declared for the status code it answered with.
export function assertResponseMatchesSchema(
  app: FastifyInstance,
  method: string,
  route: string,
  response: InjectedResponse,
  statusCode: number,
): void {
  const specification: unknown = app.swagger()
  const schema = readPath(specification, [
    'paths',
    route,
    method.toLowerCase(),
    'responses',
    String(statusCode),
    'content',
    'application/json',
    'schema',
  ])

  if (!isRecord(schema)) {
    throw new OperationFailedError('The route declares no schema for this status code', {
      context: { route, method, statusCode },
    })
  }

  const ajv = validators.get(app) ?? buildValidator()
  validators.set(app, ajv)

  const validate = ajv.compile(schema)
  const body: unknown = response.json()

  if (!validate(body)) {
    throw new OperationFailedError('The response does not match the declared OpenAPI schema', {
      context: { route, method, statusCode, errors: validate.errors },
    })
  }
}
