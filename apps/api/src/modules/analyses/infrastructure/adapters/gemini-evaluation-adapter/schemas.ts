import { Type } from 'typebox'
import { Value } from 'typebox/value'

import { MAX_FILLER_OCCURRENCES, SPEECH_FEEDBACK_PROMPT_VERSION } from './prompt.js'

import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import type {
  DeliveryFeedback,
  RhythmMeasurements,
  SpeechFeedback,
} from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import { SpeechMeasurements } from '@/modules/analyses/domain/services/speech-measurements/index.js'

const MARKUP_PATTERN = /<[A-Za-z/]|```|\[[^\]]+\]\([^)]*\)/
const text = (maxLength = 1200) => Type.String({ minLength: 1, maxLength })
const seconds = () => Type.Number({ minimum: 0, maximum: 60 })
const count = () => Type.Integer({ minimum: 0 })
const closed = { additionalProperties: false } as const

const FeedbackProperties = {
  summary: text(),
  strengths: Type.Array(Type.Object({ title: text(120), evidence: text() }, closed), {
    maxItems: 3,
  }),
  improvements: Type.Array(
    Type.Object({ title: text(120), evidence: text(), action: text() }, closed),
    { maxItems: 3 },
  ),
}

const FillerProperties = {
  status: Type.Enum(['assessed', 'partial', 'unavailable'], {
    description:
      'assessed: the entire recording was checked; partial: only some occurrences could be identified; unavailable: no reliable assessment. Never equate unavailable with zero.',
  }),
  occurrences: Type.Array(
    Type.Object(
      {
        expression: text(40),
        startSeconds: seconds(),
        endSeconds: seconds(),
        quote: text(240),
        confidence: Type.Enum(['high', 'medium']),
      },
      closed,
    ),
    {
      maxItems: MAX_FILLER_OCCURRENCES,
      description:
        'Inventory of distinct audible filler events in chronological order, including neutral occurrences. Canonical expression without elongation or punctuation. Do not provide totals.',
    },
  ),
}

const ObservationProperties = {
  audioQuality: Type.Enum(['usable', 'limited', 'unusable']),
  limitations: Type.Array(text(400), { maxItems: 5 }),
  moments: Type.Array(
    Type.Object(
      {
        startSeconds: seconds(),
        endSeconds: seconds(),
        kind: Type.Enum(['pace', 'pause', 'articulation', 'structure', 'repetition', 'delivery']),
        quote: text(240),
        observation: text(400),
        impact: text(400),
        action: text(400),
      },
      closed,
    ),
    {
      maxItems: 8,
      description:
        'Selected useful moments. Each has an audible or textual observation, listener impact and concrete action. All timestamps are approximate seconds from recording start.',
    },
  ),
  nextPractice: Type.Union(
    [
      Type.Object({ focus: text(120), exercise: text(600), successCriterion: text(400) }, closed),
      Type.Null(),
    ],
    {
      description:
        'One achievable exercise linked to the highest-impact observed issue, with an observable success criterion. Null when no reliable coaching is possible.',
    },
  ),
}

export const EvaluationFeedbackSchema = Type.Object(
  {
    ...FeedbackProperties,
    delivery: Type.Object(
      { ...ObservationProperties, fillers: Type.Object(FillerProperties, closed) },
      closed,
    ),
  },
  closed,
)

const RhythmSchema = Type.Object(
  {
    durationSeconds: Type.Number({ exclusiveMinimum: 0, maximum: 60 }),
    wordCount: count(),
    wordsPerMinute: Type.Union([count(), Type.Null()]),
    windows: Type.Array(
      Type.Object(
        {
          startSeconds: seconds(),
          endSeconds: seconds(),
          wordCount: count(),
          wordsPerMinute: count(),
        },
        closed,
      ),
      { maxItems: 6 },
    ),
  },
  closed,
)

const DeliverySchema = Type.Object(
  {
    ...ObservationProperties,
    version: Type.Literal(2),
    promptVersion: Type.Literal(SPEECH_FEEDBACK_PROMPT_VERSION),
    model: text(200),
    metrics: RhythmSchema,
    fillers: Type.Object(
      {
        ...FillerProperties,
        total: Type.Union([count(), Type.Null()]),
        perMinute: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
        byExpression: Type.Array(
          Type.Object({ expression: text(40), count: Type.Integer({ minimum: 1 }) }, closed),
          { maxItems: MAX_FILLER_OCCURRENCES },
        ),
      },
      closed,
    ),
  },
  closed,
)

const SpeechFeedbackSchema = Type.Object(
  { ...FeedbackProperties, delivery: Type.Optional(DeliverySchema) },
  closed,
)

export function parseEvaluationFeedback(
  raw: unknown,
  metrics: RhythmMeasurements,
  model: string,
): SpeechFeedback {
  if (!Value.Check(EvaluationFeedbackSchema, raw)) throw new MalformedEvaluationError('schema')
  return parseSpeechFeedback({
    ...raw,
    delivery: {
      ...raw.delivery,
      version: 2,
      promptVersion: SPEECH_FEEDBACK_PROMPT_VERSION,
      model,
      metrics,
      fillers: SpeechMeasurements.fillers(
        raw.delivery.fillers.status,
        raw.delivery.fillers.occurrences,
        metrics.durationSeconds,
      ),
    },
  })
}

export function parseSpeechFeedback(raw: unknown): SpeechFeedback {
  if (!Value.Check(SpeechFeedbackSchema, raw)) throw new MalformedEvaluationError('schema')
  for (const value of collectText(raw)) {
    if (value.trim().length === 0 || MARKUP_PATTERN.test(value))
      throw new MalformedEvaluationError('text')
  }
  if (raw.delivery !== undefined)
    validateDelivery(raw.delivery, raw.improvements.length, raw.strengths.length)
  return raw
}

function validateDelivery(
  delivery: DeliveryFeedback,
  improvementCount: number,
  strengthCount: number,
): void {
  const { metrics, fillers } = delivery
  const expected = SpeechMeasurements.fillers(
    fillers.status,
    fillers.occurrences,
    metrics.durationSeconds,
  )
  if (
    fillers.total !== expected.total ||
    fillers.perMinute !== expected.perMinute ||
    fillers.byExpression.length !== expected.byExpression.length ||
    fillers.byExpression.some(
      (item, index) =>
        item.expression !== expected.byExpression[index]?.expression ||
        item.count !== expected.byExpression[index]?.count,
    )
  )
    throw new MalformedEvaluationError('filler_counts')
  if (fillers.status === 'unavailable' && fillers.occurrences.length > 0)
    throw new MalformedEvaluationError('filler_status')
  if (fillers.occurrences.length === MAX_FILLER_OCCURRENCES && fillers.status !== 'partial')
    throw new MalformedEvaluationError('filler_coverage')
  if (
    (delivery.audioQuality !== 'usable' || fillers.status !== 'assessed') &&
    delivery.limitations.length === 0
  )
    throw new MalformedEvaluationError('limitations')
  if (
    delivery.audioQuality === 'unusable' &&
    (delivery.moments.length > 0 ||
      fillers.status !== 'unavailable' ||
      delivery.nextPractice !== null ||
      improvementCount > 0 ||
      strengthCount > 0)
  )
    throw new MalformedEvaluationError('audio_quality')
  if (improvementCount > 0 && delivery.nextPractice === null)
    throw new MalformedEvaluationError('next_practice')

  let previousEnd = 0
  for (const occurrence of fillers.occurrences) {
    validateInterval(occurrence, metrics.durationSeconds)
    if (occurrence.startSeconds < previousEnd)
      throw new MalformedEvaluationError('overlapping_fillers')
    previousEnd = occurrence.endSeconds
  }
  const moments = new Set<string>()
  for (const moment of delivery.moments) {
    validateInterval(moment, metrics.durationSeconds)
    const key = `${moment.kind}:${moment.startSeconds}:${moment.endSeconds}`
    if (moments.has(key)) throw new MalformedEvaluationError('duplicate_moment')
    moments.add(key)
  }
  validateMetrics(metrics)
}

function validateInterval(
  interval: { readonly startSeconds: number; readonly endSeconds: number },
  durationSeconds: number,
): void {
  if (interval.endSeconds <= interval.startSeconds || interval.endSeconds > durationSeconds)
    throw new MalformedEvaluationError('event_interval')
}

function validateMetrics(metrics: RhythmMeasurements): void {
  const expectedRate =
    metrics.wordCount === 0 ? null : Math.round((metrics.wordCount * 60) / metrics.durationSeconds)
  if (metrics.wordsPerMinute !== expectedRate) throw new MalformedEvaluationError('speech_rate')
  if (metrics.wordCount === 0) {
    if (metrics.windows.length > 0) throw new MalformedEvaluationError('rhythm_windows')
    return
  }
  let end = 0
  let total = 0
  for (const window of metrics.windows) {
    validateInterval(window, metrics.durationSeconds)
    if (
      window.startSeconds !== end ||
      window.endSeconds !== Math.min(end + 10, metrics.durationSeconds) ||
      window.wordsPerMinute !==
        Math.round((window.wordCount * 60) / (window.endSeconds - window.startSeconds))
    )
      throw new MalformedEvaluationError('rhythm_windows')
    end = window.endSeconds
    total += window.wordCount
  }
  if (end !== metrics.durationSeconds || total !== metrics.wordCount)
    throw new MalformedEvaluationError('rhythm_totals')
}

function collectText(feedback: SpeechFeedback): readonly string[] {
  const delivery = feedback.delivery
  return [
    feedback.summary,
    ...feedback.strengths.flatMap((item) => [item.title, item.evidence]),
    ...feedback.improvements.flatMap((item) => [item.title, item.evidence, item.action]),
    ...(delivery === undefined
      ? []
      : [
          ...delivery.limitations,
          ...delivery.fillers.occurrences.flatMap((item) => [item.expression, item.quote]),
          ...delivery.moments.flatMap((item) => [
            item.quote,
            item.observation,
            item.impact,
            item.action,
          ]),
          ...(delivery.nextPractice === null
            ? []
            : [
                delivery.nextPractice.focus,
                delivery.nextPractice.exercise,
                delivery.nextPractice.successCriterion,
              ]),
        ]),
  ]
}
