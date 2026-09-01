export interface AudioContent {
  readonly bytes: Buffer
  readonly contentType: string
  readonly durationSeconds: number
}

export interface AudioReaderPort {
  read(sessionId: string): Promise<AudioContent>
}
