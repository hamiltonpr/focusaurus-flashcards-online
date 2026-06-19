import type { Stack, GlobalSettings } from "../types"

export const DEFAULT_STACKS: Stack[] = [
  {
    id: "1",
    name: "French Vocabulary",
    cards: [
      { id: "1", front: "Hello", back: "Bonjour", cardType: 1, interval: 0 },
      { id: "2", front: "Goodbye", back: "Au revoir", cardType: 1, interval: 0 },
      { id: "3", front: "Thank you", back: "Merci", cardType: 1, interval: 0 },
    ],
    lastStudied: new Date().toISOString().split("T")[0],
    todayStats: { wordsStudied: 5, timeSpent: 12, accuracy: 80 },
    allTimeStats: { wordsStudied: 5, timeSpent: 12, sessionsCount: 1 },
  },
  {
    id: "2",
    name: "Spanish Basics",
    cards: [
      { id: "1", front: "Water", back: "Agua", cardType: 1, interval: 0 },
      { id: "2", front: "Food", back: "Comida", cardType: 1, interval: 0 },
    ],
    lastStudied: "2024-12-24",
    todayStats: { wordsStudied: 0, timeSpent: 0, accuracy: 0 },
    allTimeStats: { wordsStudied: 0, timeSpent: 0, sessionsCount: 0 },
  },
]

export const DEFAULT_SETTINGS: GlobalSettings = {
  useGlobalGoals: false,
  defaultTimeGoal: 15,
  defaultWordsGoal: 10,
  priority: "new-words",
  notificationsEnabled: false,
}
