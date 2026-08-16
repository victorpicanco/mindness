export interface UnitOfWork {
  run<T>(operation: () => Promise<T>): Promise<T>
}
