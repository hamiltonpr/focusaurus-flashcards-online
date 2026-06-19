export interface Card {
  id: string
  front: string
  back: string
  mastered?: boolean
  // Spaced repetition
  cardType: 1 | 2        // 1 = still learning, 2 = learned/promoted
  interval: number       // days gap used to schedule last review (0 = never reviewed)
  nextReviewDate?: string // YYYY-MM-DD
}

export interface StudySessionSummary {
  wordsStudied: number
  timeSpentMinutes: number
  accuracy: number
  completedAt: string
}

export type TestMode = "practice" | "check"

/** In-progress one-pass knowledge check; cleared when the check finishes. */
export interface KnowledgeCheckProgress {
  seenCardIds: string[]
}

export interface TestSessionSummary {
  accuracy: number
  durationMinutes: number
  avgSecondsPerCard: number
  cardsTotal: number
  completedAt: string
  testMode?: TestMode
}

export interface TestStatsBucket {
  sessionsCount: number
  accuracy: number
  durationMinutes: number
  avgSecondsPerCard: number
  totalCardsTested: number
}

export interface Stack {
  id: string
  name: string
  cards: Card[]
  lastStudied?: string
  todayStats: {
    wordsStudied: number
    timeSpent: number   // minutes
    accuracy: number    // percentage
  }
  allTimeStats: {
    wordsStudied: number
    timeSpent: number   // minutes
    sessionsCount: number
  }
  lastStudySession?: StudySessionSummary
  lastTestSession?: TestSessionSummary
  knowledgeCheckProgress?: KnowledgeCheckProgress
  todayTestStats?: TestStatsBucket
  allTimeTestStats?: TestStatsBucket
  savedGoal?: StudyGoal
  stackSettings?: StackSettings
}

export interface StackSettings {
  loopSize: number         // default 4
  shortTermSize: number    // default 5
  wrongStreakLimit: number // default 3
  notificationsEnabled?: boolean // default true when global notifications are on
}

export interface StudyGoal {
  type: "time" | "words"
  target: number
  rememberSetting: boolean
}

export interface GlobalSettings {
  useGlobalGoals: boolean
  defaultTimeGoal: number
  defaultWordsGoal: number
  priority: "new-words" | "solidify" // new-words = prioritize type-1, solidify = prioritize type-2
  notificationsEnabled?: boolean
}
