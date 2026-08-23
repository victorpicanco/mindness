import { describe, expect, it } from 'vitest'

import { GuidanceSelector } from './index.js'
import type { PillarGuidanceSet, PillarName } from './types.js'

describe('GuidanceSelector', () => {
  it('selects every guidance below the threshold in fixed pillar order', () => {
    const guidance = GuidanceSelector.select(
      scores({ clarity: 70, rhythm: 90, fluency: 60, mastery: 85 }),
    )

    expect(guidance).toEqual([selected('clarity', 70), selected('fluency', 60)])
  })

  it.each([
    [{ clarity: 80, rhythm: 90, fluency: 85, mastery: 95 }, [selected('clarity', 80)]],
    [{ clarity: 100, rhythm: 100, fluency: 100, mastery: 100 }, [selected('clarity', 100)]],
    [
      { clarity: 79, rhythm: 79, fluency: 79, mastery: 79 },
      [
        selected('clarity', 79),
        selected('rhythm', 79),
        selected('fluency', 79),
        selected('mastery', 79),
      ],
    ],
    [{ clarity: 80, rhythm: 81, fluency: 82, mastery: 83 }, [selected('clarity', 80)]],
    [{ clarity: 95, rhythm: 90, fluency: 99, mastery: 81 }, [selected('mastery', 81)]],
  ])('returns a non-empty unique selection for the supplied scores', (pillars, expected) => {
    const guidance = GuidanceSelector.select(scores(pillars))

    expect(guidance).toEqual(expected)
    expect(guidance).not.toHaveLength(0)
    expect(new Set(guidance.map(({ pillar }) => pillar))).toHaveLength(guidance.length)
  })
})

function scores(values: Record<PillarName, number>): PillarGuidanceSet {
  return {
    clarity: { score: values.clarity, guidance: 'clarity guidance' },
    rhythm: { score: values.rhythm, guidance: 'rhythm guidance' },
    fluency: { score: values.fluency, guidance: 'fluency guidance' },
    mastery: { score: values.mastery, guidance: 'mastery guidance' },
  }
}

function selected(pillar: PillarName, score: number) {
  return { pillar, score, guidance: `${pillar} guidance` }
}
