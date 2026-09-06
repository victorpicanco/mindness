export function createDeliveryFeedback() {
  return {
    version: 2,
    promptVersion: 'speech-feedback-v2',
    model: 'test-model',
    audioQuality: 'usable',
    limitations: [],
    metrics: {
      durationSeconds: 30,
      wordCount: 60,
      wordsPerMinute: 120,
      windows: [0, 10, 20].map((startSeconds) => ({
        startSeconds,
        endSeconds: startSeconds + 10,
        wordCount: 20,
        wordsPerMinute: 120,
      })),
    },
    fillers: {
      status: 'assessed',
      total: 2,
      perMinute: 4,
      byExpression: [{ expression: 'é', count: 2 }],
      occurrences: [
        {
          expression: 'é',
          startSeconds: 1,
          endSeconds: 1.5,
          quote: 'é... a proposta',
          confidence: 'high',
        },
        {
          expression: 'é',
          startSeconds: 8,
          endSeconds: 8.5,
          quote: 'é... o benefício',
          confidence: 'medium',
        },
      ],
    },
    moments: [
      {
        startSeconds: 20,
        endSeconds: 25,
        kind: 'pace',
        quote: 'O benefício final',
        observation: 'As palavras finais ficam pouco distinguíveis.',
        impact: 'O benefício fica mais difícil de acompanhar.',
        action: 'Faça uma pausa antes desta frase.',
      },
    ],
    nextPractice: {
      focus: 'Dê espaço ao benefício',
      exercise: 'Repita a conclusão com uma pausa antes do benefício.',
      successCriterion: 'Conclua o benefício sem acrescentar uma ideia nova.',
    },
  }
}
