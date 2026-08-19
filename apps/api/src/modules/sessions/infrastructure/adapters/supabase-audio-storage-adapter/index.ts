import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  AudioStoragePort,
  UploadUrl,
} from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

interface StorageResult {
  readonly data: unknown
  readonly error: unknown
}

interface SupabaseStorageFileApi {
  createSignedUploadUrl(
    path: string,
    options: { readonly upsert: boolean },
  ): PromiseLike<StorageResult>
  list(path: string, options: { readonly search: string }): PromiseLike<StorageResult>
  download(path: string): PromiseLike<StorageResult>
  remove(paths: string[]): PromiseLike<StorageResult>
}

export interface SupabaseAudioStorageClient {
  readonly storage: {
    from(bucketName: string): SupabaseStorageFileApi
  }
}

class AudioStorageProviderError extends InfrastructureError {
  readonly code = 'sessions.AUDIO_STORAGE_PROVIDER_ERROR'

  constructor(operation: string, cause?: unknown) {
    super('Audio storage provider failed', {
      context: { operation },
      ...(cause === undefined ? {} : { cause }),
    })
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
  constructor(client: SupabaseAudioStorageClient)
  constructor(client: SupabaseClient)
  constructor(private readonly client: SupabaseAudioStorageClient) {}

  async createUploadUrl(path: string): Promise<UploadUrl> {
    const result = await this.call('create_signed_upload_url', () =>
      this.bucket().createSignedUploadUrl(path, { upsert: true }),
    )
    if (!isRecord(result.data)) {
      throw new AudioStorageProviderError('create_signed_upload_url', result.data)
    }

    const uploadUrl = readString(result.data, 'signedUrl')
    const token = readString(result.data, 'token')
    if (uploadUrl === null || token === null) {
      throw new AudioStorageProviderError('create_signed_upload_url', result.data)
    }

    return { uploadUrl, token }
  }

  async getObjectSize(path: string): Promise<number | null> {
    const { directory, fileName } = splitObjectPath(path)
    const result = await this.call('list', () =>
      this.bucket().list(directory, { search: fileName }),
    )
    if (!Array.isArray(result.data)) {
      throw new AudioStorageProviderError('list', result.data)
    }

    for (const entry of result.data) {
      if (!isRecord(entry) || readString(entry, 'name') !== fileName) continue

      const metadata = entry.metadata
      if (!isRecord(metadata) || typeof metadata.size !== 'number') {
        throw new AudioStorageProviderError('list', entry)
      }

      return metadata.size
    }

    return null
  }

  async downloadObject(path: string): Promise<Buffer> {
    const result = await this.call('download', () => this.bucket().download(path))
    if (!(result.data instanceof Blob)) {
      throw new AudioStorageProviderError('download', result.data)
    }

    return Buffer.from(await result.data.arrayBuffer())
  }

  async removeObject(path: string): Promise<void> {
    await this.call('remove', () => this.bucket().remove([path]))
  }

  private bucket(): SupabaseStorageFileApi {
    return this.client.storage.from('session-audio')
  }

  private async call(
    operation: string,
    call: () => PromiseLike<StorageResult>,
  ): Promise<StorageResult> {
    try {
      const result = await call()
      if (result.error !== null) throw new AudioStorageProviderError(operation, result.error)

      return result
    } catch (error) {
      if (error instanceof AudioStorageProviderError) throw error
      throw new AudioStorageProviderError(operation, error)
    }
  }
}
