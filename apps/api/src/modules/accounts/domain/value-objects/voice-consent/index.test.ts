import { describe, expect, it } from 'vitest'

import { VoiceConsent } from './index.js'

const acceptedAt = new Date('2026-08-15T00:00:00.000Z')

describe('VoiceConsent', () => {
  it('records the accepted version under the single supported purpose', () => {
    const consent = VoiceConsent.create({ version: '2026-08-15', acceptedAt })

    expect(consent).toMatchObject({
      purpose: 'voice_recording_and_analysis',
      version: '2026-08-15',
      acceptedAt,
    })
  })

  it('compares by value, not by reference', () => {
    const consent = VoiceConsent.create({ version: '2026-08-15', acceptedAt })

    expect(consent.equals(VoiceConsent.create({ version: '2026-08-15', acceptedAt }))).toBe(true)
    expect(consent.equals(VoiceConsent.create({ version: '2026-01-01', acceptedAt }))).toBe(false)
    expect(
      consent.equals(
        VoiceConsent.create({ version: '2026-08-15', acceptedAt: new Date('2026-08-16') }),
      ),
    ).toBe(false)
  })
})
