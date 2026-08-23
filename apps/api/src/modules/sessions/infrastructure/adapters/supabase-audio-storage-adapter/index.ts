import type {
  AudioStoragePort,
  UploadUrl,
} from '@/modules/sessions/domain/ports/audio-storage-port/index.js'

import { AudioStorageProviderError } from './errors.js'

const BUCKET = 'session-audio'

interface StorageResult {
  readonly data: unknown
  readonly error: unknown
}

interface SupabaseStorageFileApi {
  createSignedUploadUrl(
    path: string,
    options: { readonly upsert: boolean },
  ): PromiseLike<StorageResult>
  createSignedUrl(path: string, expiresIn: number): PromiseLike<StorageResult>
  list(path: string, options: { readonly search: string }): PromiseLike<StorageResult>
  download(path: string): PromiseLike<StorageResult>
  remove(paths: string[]): PromiseLike<StorageResult>
}

export interface SupabaseAudioStorageClient {
  readonly storage: {
    from(bucketName: string): SupabaseStorageFileApi
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function splitObjectPath(path: string): { readonly directory: string; readonly fileName: string } {
  const separator = path.lastIndexOf('/')
  if (separator < 0) return { directory: '', fileName: path }

  return { directory: path.slice(0, separator), fileName: path.slice(separator + 1) }
}

export class SupabaseAudioStorageAdapter implements AudioStoragePort {
  constructor(private readonly client: SupabaseAudioStorageClient) {}

  async createUploadUrl(path: string): Promise<UploadUrl> {
    const result = await this.call('create_signed_upload_url', () =>
      this.bucket().createSignedUploadUrl(path, { upsert: true }),
    )
    const uploadUrl = isRecord(result.data) ? readString(result.data, 'signedUrl') : null
    const token = isRecord(result.data) ? readString(result.data, 'token') : null

    // The payload carries the signed URL and the upload token, so a malformed response is
    // reported by naming the missing fields — never by attaching the payload as `cause`,
    // which the error handler writes to the log.
    if (uploadUrl === null || token === null) {
      throw new AudioStorageProviderError('create_signed_upload_url', {
        missingFields: [
          ...(uploadUrl === null ? ['signedUrl'] : []),
          ...(token === null ? ['token'] : []),
        ],
      })
    }

    return { uploadUrl, token }
  }

  async createDownloadUrl(path: string, expiresInSeconds: number): Promise<string> {
    const result = await this.call('create_signed_url', () =>
      this.bucket().createSignedUrl(path, expiresInSeconds),
    )
    const signedUrl = isRecord(result.data) ? readString(result.data, 'signedUrl') : null

    if (signedUrl === null) {
      throw new AudioStorageProviderError('create_signed_url', { missingFields: ['signedUrl'] })
    }

    return signedUrl
  }

  async getObjectSize(path: string): Promise<number | null> {
    const { directory, fileName } = splitObjectPath(path)
    const result = await this.call('list', () =>
      this.bucket().list(directory, { search: fileName }),
    )
    if (!Array.isArray(result.data)) {
      throw new AudioStorageProviderError('list', { reason: 'listing_was_not_an_array' })
    }

    for (const entry of result.data) {
      if (!isRecord(entry) || readString(entry, 'name') !== fileName) continue

      const metadata = entry.metadata
      if (!isRecord(metadata) || typeof metadata.size !== 'number') {
        throw new AudioStorageProviderError('list', { reason: 'entry_without_numeric_size' })
      }

      return metadata.size
    }

    return null
  }

  async downloadObject(path: string): Promise<Buffer> {
    const result = await this.call('download', () => this.bucket().download(path))
    if (!(result.data instanceof Blob)) {
      throw new AudioStorageProviderError('download', { reason: 'payload_was_not_a_blob' })
    }

    return Buffer.from(await result.data.arrayBuffer())
  }

  async removeObject(path: string): Promise<void> {
    await this.call('remove', () => this.bucket().remove([path]))
  }

  private bucket(): SupabaseStorageFileApi {
    return this.client.storage.from(BUCKET)
  }

  private async call(
    operation: string,
    call: () => PromiseLike<StorageResult>,
  ): Promise<StorageResult> {
    try {
      const result = await call()
      if (result.error !== null && result.error !== undefined) {
        throw new AudioStorageProviderError(operation, result.error)
      }

      return result
    } catch (error) {
      if (error instanceof AudioStorageProviderError) throw error
      throw new AudioStorageProviderError(operation, error)
    }
  }
}

export { AudioStorageProviderError } from './errors.js'
