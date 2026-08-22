import { describe, expect, it } from 'vitest'

import { GuidanceSelector } from './index.js'
import type { PillarGuidance } from './types.js'

describe('GuidanceSelector', () => {
  it('selects every guidance below the threshold in fixed pillar order', () => {
    const guidance = GuidanceSelector.select([
      pillar('clarity', 70),
      pillar('rhythm', 90),
      pillar('fluency', 60),
      pillar('mastery', 85),
    ])

    expect(guidance).toEqual([pillar('clarity', 70), pillar('fluency', 60)])
  })

  it.each([
    [
      [pillar('clarity', 80), pillar('rhythm', 90), pillar('fluency', 85), pillar('mastery', 95)],
      [pillar('clarity', 80)],
    ],
    [
      [
        pillar('clarity', 100),
        pillar('rhythm', 100),
        pillar('fluency', 100),
        pillar('mastery', 100),
      ],
      [pillar('clarity', 100)],
    ],
    [
      [pillar('clarity', 79), pillar('rhythm', 79), pillar('fluency', 79), pillar('mastery', 79)],
      [pillar('clarity', 79), pillar('rhythm', 79), pillar('fluency', 79), pillar('mastery', 79)],
    ],
    [
      [pillar('clarity', 80), pillar('rhythm', 81), pillar('fluency', 82), pillar('mastery', 83)],
      [pillar('clarity', 80)],
    ],
  ])('returns a non-empty unique selection for the supplied scores', (pillars, expected) => {
    const guidance = GuidanceSelector.select(pillars)

    expect(guidance).toEqual(expected)
    expect(guidance).not.toHaveLength(0)
    expect(new Set(guidance.map(({ pillar: pillarName }) => pillarName))).toHaveLength(
      guidance.length,
    )
  })
})

function pillar(pillarName: PillarGuidance['pillar'], score: number): PillarGuidance {
  return { pillar: pillarName, score, guidance: `${pillarName} guidance` }
}
