export interface UploadUrl {
  readonly uploadUrl: string
  readonly token: string
}

export interface AudioStoragePort {
  createUploadUrl(path: string): Promise<UploadUrl>
  createDownloadUrl(path: string, expiresInSeconds: number): Promise<string>
  getObjectSize(path: string): Promise<number | null>
  downloadObject(path: string): Promise<Buffer>
  removeObject(path: string): Promise<void>
}
