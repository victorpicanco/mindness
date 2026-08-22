export const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const

export interface ShutdownLogger {
  error(object: { readonly err: unknown }, message: string): void
  info(object: Record<string, never>, message: string): void
}

export interface ShutdownSignalsDeps {
  readonly close: () => Promise<void>
  readonly logger: ShutdownLogger
  readonly once?: (signal: NodeJS.Signals, handler: () => void) => void
  readonly exit?: (code: number) => void
}

export function registerShutdownSignals(deps: ShutdownSignalsDeps): void {
  const once = deps.once ?? ((signal, handler) => void process.once(signal, handler))
  // Prisma and ioredis keep handles open, so the loop does not drain on its own after close.
  const exit = deps.exit ?? ((code) => process.exit(code))
  let closing = false

  const shutdown = async (): Promise<void> => {
    if (closing) return
    closing = true

    try {
      await deps.close()
      deps.logger.info({}, 'Shutdown complete')
      exit(0)
    } catch (error) {
      deps.logger.error({ err: error }, 'Graceful shutdown failed')
      exit(1)
    }
  }

  for (const signal of SHUTDOWN_SIGNALS) {
    once(signal, () => {
      void shutdown()
    })
  }
}
