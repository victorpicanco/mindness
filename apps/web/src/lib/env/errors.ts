export class EnvironmentError extends Error {
  readonly code = 'web.ENVIRONMENT_INVALID'
  readonly variables: readonly string[]

  constructor(variables: readonly string[], cause: unknown) {
    super(`The environment is not configured: ${variables.join(', ')}`, { cause })
    this.name = 'EnvironmentError'
    this.variables = variables
  }
}
