export interface Card {
  id: string
  front: string
  back: string
  mastered?: boolean
}

export interface Stack {
  id: string
  name: string
  cards: Card[]
  lastStudied?: string
  todayStats: {
    wordsStudied: number
    timeSpent: number // in minutes
    accuracy: number // percentage
  }
  savedGoal?: StudyGoal
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
}
