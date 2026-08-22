export interface AudioReaderPort {
  read(sessionId: string): Promise<Buffer>
}
