import { describe, expect, it } from 'vitest'

import { MicrophoneUnavailableError } from '@/lib/media/microphone-unavailable-error'

describe('MicrophoneUnavailableError', () => {
  it('provides one stable error identity for every microphone entry point', () => {
    const cause = new DOMException('Permission denied', 'NotAllowedError')
    const error = new MicrophoneUnavailableError(cause)

    expect(error).toBeInstanceOf(MicrophoneUnavailableError)
    expect(error).toMatchObject({ code: 'web.MICROPHONE_UNAVAILABLE', cause })
  })
})
