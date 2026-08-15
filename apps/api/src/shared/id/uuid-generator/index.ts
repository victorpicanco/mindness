import { randomUUID } from 'node:crypto'

export class UuidGenerator {
  generate(): string {
    return randomUUID()
  }
}
