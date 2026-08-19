import { describe, expect, it } from 'vitest'

import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

import { SupabaseAudioStorageAdapter } from './index.js'

interface StorageResult {
  readonly data: unknown
  readonly error: unknown
}

function createStorageClient() {
  const calls: string[] = []
  let createUploadUrlResult: StorageResult = {
    data: { signedUrl: 'https://storage.test/upload', token: 'upload-token' },
    error: null,
  }
  let listResult: StorageResult = {
    data: [{ name: 'audio', metadata: { size: 1_024 } }],
    error: null,
  }
  let downloadResult: StorageResult = {
    data: new Blob(['audio bytes'], { type: 'audio/webm' }),
    error: null,
  }
  let removeResult: StorageResult = { data: [], error: null }

  return {
    calls,
    client: {
      storage: {
        from(bucketName: string) {
          calls.push(`from:${bucketName}`)

          return {
            createSignedUploadUrl(path: string, options: { readonly upsert: boolean }) {
              calls.push(`createSignedUploadUrl:${path}:${String(options.upsert)}`)
              return Promise.resolve(createUploadUrlResult)
            },
            list(path: string, options: { readonly search: string }) {
              calls.push(`list:${path}:${options.search}`)
              return Promise.resolve(listResult)
            },
            download(path: string) {
              calls.push(`download:${path}`)
              return Promise.resolve(downloadResult)
            },
            remove(paths: string[]) {
              calls.push(`remove:${paths.join(',')}`)
              return Promise.resolve(removeResult)
            },
          }
        },
      },
    },
    setCreateUploadUrlResult(result: StorageResult) {
      createUploadUrlResult = result
    },
    setListResult(result: StorageResult) {
      listResult = result
    },
    setDownloadResult(result: StorageResult) {
      downloadResult = result
    },
    setRemoveResult(result: StorageResult) {
      removeResult = result
    },
  }
}

describe('SupabaseAudioStorageAdapter', () => {
  it('creates an upsertable signed upload URL', async () => {
    const storage = createStorageClient()
    const adapter = new SupabaseAudioStorageAdapter(storage.client)

    await expect(adapter.createUploadUrl('account-1/session-1/audio')).resolves.toEqual({
      uploadUrl: 'https://storage.test/upload',
      token: 'upload-token',
    })
    expect(storage.calls).toEqual([
      'from:session-audio',
      'createSignedUploadUrl:account-1/session-1/audio:true',
    ])
  })

  it('returns the stored object size when the object exists', async () => {
    const storage = createStorageClient()
    const adapter = new SupabaseAudioStorageAdapter(storage.client)

    await expect(adapter.getObjectSize('account-1/session-1/audio')).resolves.toBe(1_024)
    expect(storage.calls).toEqual(['from:session-audio', 'list:account-1/session-1:audio'])
  })

  it('returns null when the object does not exist', async () => {
    const storage = createStorageClient()
    storage.setListResult({ data: [], error: null })
    const adapter = new SupabaseAudioStorageAdapter(storage.client)

    await expect(adapter.getObjectSize('account-1/session-1/audio')).resolves.toBeNull()
  })

  it('downloads the stored Blob as a Buffer', async () => {
    const storage = createStorageClient()
    const adapter = new SupabaseAudioStorageAdapter(storage.client)

    await expect(adapter.downloadObject('account-1/session-1/audio')).resolves.toEqual(
      Buffer.from('audio bytes'),
    )
    expect(storage.calls).toEqual(['from:session-audio', 'download:account-1/session-1/audio'])
  })

  it('removes the stored object', async () => {
    const storage = createStorageClient()
    const adapter = new SupabaseAudioStorageAdapter(storage.client)

    await expect(adapter.removeObject('account-1/session-1/audio')).resolves.toBeUndefined()
    expect(storage.calls).toEqual(['from:session-audio', 'remove:account-1/session-1/audio'])
  })

  it.each([
    [
      'create upload URL',
      (storage: ReturnType<typeof createStorageClient>, error: unknown) => {
        storage.setCreateUploadUrlResult({ data: null, error })
        return new SupabaseAudioStorageAdapter(storage.client).createUploadUrl(
          'account-1/session-1/audio',
        )
      },
    ],
    [
      'list object',
      (storage: ReturnType<typeof createStorageClient>, error: unknown) => {
        storage.setListResult({ data: null, error })
        return new SupabaseAudioStorageAdapter(storage.client).getObjectSize(
          'account-1/session-1/audio',
        )
      },
    ],
    [
      'download object',
      (storage: ReturnType<typeof createStorageClient>, error: unknown) => {
        storage.setDownloadResult({ data: null, error })
        return new SupabaseAudioStorageAdapter(storage.client).downloadObject(
          'account-1/session-1/audio',
        )
      },
    ],
    [
      'remove object',
      (storage: ReturnType<typeof createStorageClient>, error: unknown) => {
        storage.setRemoveResult({ data: null, error })
        return new SupabaseAudioStorageAdapter(storage.client).removeObject(
          'account-1/session-1/audio',
        )
      },
    ],
  ])(
    'translates client errors while preserving their cause when it tries to %s',
    async (_name, call) => {
      const storage = createStorageClient()
      const error = { code: 'storage_error' }

      await expect(call(storage, error)).rejects.toBeInstanceOf(InfrastructureError)
      await expect(call(storage, error)).rejects.toMatchObject({ cause: error })
    },
  )
})
