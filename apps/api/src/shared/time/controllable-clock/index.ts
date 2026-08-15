export class ControllableClock {
  private current: Date

  constructor(initial: Date) {
    this.current = initial
  }

  now(): Date {
    return this.current
  }

  set(date: Date): void {
    this.current = date
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms)
  }
}
