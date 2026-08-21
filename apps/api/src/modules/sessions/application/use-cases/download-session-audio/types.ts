export interface DownloadSessionAudioInput {
  readonly sessionId: string
}
export interface DownloadSessionAudioDependencies {
  readonly sessions: {
    findById(sessionId: string): Promise<{
      readonly id: string
      readonly audio: { readonly storagePath: string } | null
    } | null>
  }
  readonly audioStorage: { downloadObject(path: string): Promise<Buffer> }
}
