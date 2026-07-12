import { type AdminConfig } from './adminConfig'

export interface AnswerAttempt {
  answer: string
  isCorrect: boolean
  submittedAt: string
}

export interface GameProgress {
  completedDays: number[]
  unlockedLetters: Record<number, string>
  submittedAnswers: Record<number, string>
  attachedImages: Record<number, string>
  answerAttempts: Record<number, AnswerAttempt[]>
  finalPhraseCompleted: boolean
}

export const defaultProgress: GameProgress = {
  completedDays: [],
  unlockedLetters: {},
  submittedAnswers: {},
  attachedImages: {},
  answerAttempts: {},
  finalPhraseCompleted: false,
}

interface GameStoreResponse {
  config: AdminConfig | null
  progress: Partial<GameProgress> | null
}

function normalizeAttempts(attempts?: Partial<GameProgress>['answerAttempts']): Record<number, AnswerAttempt[]> {
  if (!attempts || typeof attempts !== 'object' || Array.isArray(attempts)) {
    return {}
  }

  return Object.entries(attempts).reduce<Record<number, AnswerAttempt[]>>((acc, [day, value]) => {
    const dayNumber = Number(day)
    if (Number.isNaN(dayNumber) || !Array.isArray(value)) return acc

    const safeAttempts = value.filter((attempt): attempt is AnswerAttempt =>
      Boolean(attempt) &&
      typeof attempt.answer === 'string' &&
      typeof attempt.isCorrect === 'boolean' &&
      typeof attempt.submittedAt === 'string'
    )

    if (safeAttempts.length > 0) {
      acc[dayNumber] = safeAttempts
    }

    return acc
  }, {})
}

function normalizeProgress(progress?: Partial<GameProgress> | null): GameProgress {
  return {
    completedDays: Array.isArray(progress?.completedDays) ? progress.completedDays : defaultProgress.completedDays,
    unlockedLetters: progress?.unlockedLetters && typeof progress.unlockedLetters === 'object'
      ? progress.unlockedLetters
      : defaultProgress.unlockedLetters,
    submittedAnswers: progress?.submittedAnswers && typeof progress.submittedAnswers === 'object'
      ? progress.submittedAnswers
      : defaultProgress.submittedAnswers,
    attachedImages: progress?.attachedImages && typeof progress.attachedImages === 'object'
      ? progress.attachedImages
      : defaultProgress.attachedImages,
    answerAttempts: normalizeAttempts(progress?.answerAttempts),
    finalPhraseCompleted: typeof progress?.finalPhraseCompleted === 'boolean'
      ? progress.finalPhraseCompleted
      : defaultProgress.finalPhraseCompleted,
  }
}

export async function loadProgress(): Promise<GameProgress> {
  try {
    const response = await fetch('/api/game-store')
    if (!response.ok) return defaultProgress
    const data = (await response.json()) as GameStoreResponse
    return normalizeProgress(data.progress)
  } catch {
    return defaultProgress
  }
}

export async function saveProgress(progress: GameProgress): Promise<void> {
  const response = await fetch('/api/game-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save-progress', progress }),
  })

  if (!response.ok) {
    throw new Error('Falha ao salvar progresso')
  }
}
