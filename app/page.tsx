"use client"

import { useState } from "react"
import StacksTab from "./components/stacks-tab"
import type { Stack } from "./types"

export default function FocusaurusApp() {
  const [stacks, setStacks] = useState<Stack[]>([
    {
      id: "1",
      name: "French Vocabulary",
      cards: [
        { id: "1", front: "Hello", back: "Bonjour" },
        { id: "2", front: "Goodbye", back: "Au revoir" },
        { id: "3", front: "Thank you", back: "Merci" },
      ],
      lastStudied: new Date().toISOString().split("T")[0],
      todayStats: { wordsStudied: 5, timeSpent: 12, accuracy: 80 },
    },
    {
      id: "2",
      name: "Spanish Basics",
      cards: [
        { id: "1", front: "Water", back: "Agua" },
        { id: "2", front: "Food", back: "Comida" },
      ],
      lastStudied: "2024-12-24",
      todayStats: { wordsStudied: 0, timeSpent: 0, accuracy: 0 },
    },
  ])

  const [globalSettings, setGlobalSettings] = useState({
    useGlobalGoals: false,
    defaultTimeGoal: 15,
    defaultWordsGoal: 10,
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-center mb-2">🦕 Focusaurus</h1>
          <p className="text-muted-foreground text-center">Master your flashcards, one stack at a time</p>
        </header>

        <StacksTab
          stacks={stacks}
          setStacks={setStacks}
          globalSettings={globalSettings}
          setGlobalSettings={setGlobalSettings}
        />
      </div>
    </div>
  )
}
