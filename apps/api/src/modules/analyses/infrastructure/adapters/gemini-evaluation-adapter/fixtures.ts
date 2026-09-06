export function createDetailedFeedback() {
  return {
    summary: 'Your opening is direct. Pause before the final benefit.',
    strengths: [{ title: 'Opening', evidence: 'You introduce the benefit immediately.' }],
    improvements: [
      {
        title: 'Pace',
        evidence: 'The closing words run together.',
        action: 'Pause before the final benefit.',
      },
    ],
    delivery: {
      audioQuality: 'usable',
      limitations: [],
      fillers: {
        status: 'assessed',
        occurrences: [
          {
            expression: 'é',
            startSeconds: 1,
            endSeconds: 1.5,
            quote: 'é... the benefit',
            confidence: 'high',
          },
          {
            expression: 'é',
            startSeconds: 8,
            endSeconds: 8.5,
            quote: 'é... the proposal',
            confidence: 'medium',
          },
        ],
      },
      moments: [
        {
          startSeconds: 20,
          endSeconds: 25,
          kind: 'pace',
          quote: 'The final benefit',
          observation: 'The final words run together.',
          impact: 'The benefit becomes harder to follow.',
          action: 'Pause before this sentence.',
        },
      ],
      nextPractice: {
        focus: 'Make the benefit clear',
        exercise: 'Repeat the closing with a pause before the benefit.',
        successCriterion: 'Finish the benefit without adding a new idea.',
      },
    },
  }
}
