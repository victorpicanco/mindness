export interface UploadUrl {
  readonly uploadUrl: string
  readonly token: string
}

export interface AudioStoragePort {
  createUploadUrl(path: string): Promise<UploadUrl>
  getObjectSize(path: string): Promise<number | null>
  downloadObject(path: string): Promise<Buffer>
  removeObject(path: string): Promise<void>
}
