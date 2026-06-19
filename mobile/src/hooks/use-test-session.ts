import { useReducer, useMemo } from "react"
import type { Card, TestMode } from "../types"
import type { SessionCard } from "./use-study-session"
import { applyKnowledgeCheckAnswer, getKnowledgeCheckPool } from "../lib/spaced-repetition"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How far ahead a missed card is re-queued (1 = every other card). */
export type TestSpacingLevel = 1 | 2 | 3 | 4 | 8 | "end"

export interface KnowledgeCheckAnswer {
  cardId: string
  known: boolean
}

export interface TestQueueItem {
  card: Card
  /** Undefined = first pass through the test queue. */
  spacingLevel?: TestSpacingLevel
}

export interface TestUndoSnapshot {
  queue: TestQueueItem[]
  currentIndex: number
  cards: Card[]
  isFlipped: boolean
  isComplete: boolean
  cardsCompleted: number
  firstPassCorrect: number
  sessionAnswers: KnowledgeCheckAnswer[]
}

export interface TestSessionState {
  mode: TestMode
  /** Live stack cards — updated in check mode as you answer. */
  cards: Card[]
  queue: TestQueueItem[]
  currentIndex: number
  isFlipped: boolean
  isComplete: boolean
  sessionStartTime: number
  /** Cards fully cleared (practice: first-pass correct or passed review; check: any answer). */
  cardsCompleted: number
  totalCards: number
  /** Practice: remembered on the first pass without a retry. Check: marked as known. */
  firstPassCorrect: number
  /** Card IDs answered during this session (check mode). */
  sessionAnswers: KnowledgeCheckAnswer[]
  /** Cards already checked before this session started (check mode). */
  initialSeenCount: number
  /** State snapshots before each answer — used to swipe back and reanswer. */
  undoStack: TestUndoSnapshot[]
}

type TestAction =
  | { type: "FLIP" }
  | { type: "UNFLIP" }
  | { type: "MARK_REMEMBERED" }
  | { type: "MARK_FORGOT" }
  | { type: "GO_BACK" }

export interface UseTestSessionOptions {
  mode: TestMode
  /** Card IDs already seen in an in-progress knowledge check. */
  seenCardIds?: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function spacingToInsertIndex(spacing: Exclude<TestSpacingLevel, "end">, queueLength: number): number {
  return Math.min(spacing - 1, queueLength)
}

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  const next = [...arr]
  next.splice(index, 0, item)
  return next
}

function removeAt<T>(arr: T[], index: number): T[] {
  return [...arr.slice(0, index), ...arr.slice(index + 1)]
}

function nextIndexAfterRemoval(length: number, removedIndex: number): number {
  if (length === 0) return 0
  return removedIndex >= length ? 0 : removedIndex
}

function spacingOnForgot(item: TestQueueItem): TestSpacingLevel {
  const level = item.spacingLevel
  if (level === undefined) return 4
  if (level === "end") return 8
  if (level === 8) return 4
  if (level === 4) return 3
  if (level === 3) return 2
  if (level === 2) return 1
  return 1
}

function spacingOnRememberedRetry(item: TestQueueItem): TestSpacingLevel | "done" {
  const level = item.spacingLevel
  if (level === undefined) return "done"
  if (level === 4) return 8
  if (level === 8) return "end"
  if (level === "end") return "done"
  if (level === 1) return 2
  if (level === 2) return 3
  if (level === 3) return 4
  return "done"
}

function requeueItem(
  queue: TestQueueItem[],
  currentIndex: number,
  item: TestQueueItem,
  spacing: TestSpacingLevel,
): { queue: TestQueueItem[]; currentIndex: number } {
  const without = removeAt(queue, currentIndex)
  const updated: TestQueueItem = { ...item, spacingLevel: spacing }
  const insertIndex =
    spacing === "end" ? without.length : spacingToInsertIndex(spacing, without.length)
  const nextQueue = insertAt(without, insertIndex, updated)
  return {
    queue: nextQueue,
    currentIndex: nextIndexAfterRemoval(nextQueue.length, currentIndex),
  }
}

function handlePracticeRemembered(state: TestSessionState): TestSessionState {
  const item = state.queue[state.currentIndex]
  if (!item) return state

  const outcome = spacingOnRememberedRetry(item)

  if (outcome === "done") {
    const without = removeAt(state.queue, state.currentIndex)
    const nextIndex = nextIndexAfterRemoval(without.length, state.currentIndex)
    const firstPass = item.spacingLevel === undefined
    return {
      ...state,
      queue: without,
      currentIndex: nextIndex,
      isFlipped: false,
      isComplete: without.length === 0,
      cardsCompleted: state.cardsCompleted + 1,
      firstPassCorrect: state.firstPassCorrect + (firstPass ? 1 : 0),
    }
  }

  const { queue, currentIndex } = requeueItem(state.queue, state.currentIndex, item, outcome)
  return {
    ...state,
    queue,
    currentIndex,
    isFlipped: false,
    isComplete: queue.length === 0,
  }
}

function handlePracticeForgot(state: TestSessionState): TestSessionState {
  const item = state.queue[state.currentIndex]
  if (!item) return state

  const spacing = spacingOnForgot(item)
  const { queue, currentIndex } = requeueItem(state.queue, state.currentIndex, item, spacing)
  return {
    ...state,
    queue,
    currentIndex,
    isFlipped: false,
    isComplete: queue.length === 0,
  }
}

function handleCheckAnswer(state: TestSessionState, known: boolean): TestSessionState {
  const item = state.queue[state.currentIndex]
  if (!item) return state

  const without = removeAt(state.queue, state.currentIndex)
  const nextIndex = nextIndexAfterRemoval(without.length, state.currentIndex)
  const cards = applyKnowledgeCheckAnswer(state.cards, item.card.id, known)
  return {
    ...state,
    cards,
    queue: without,
    currentIndex: nextIndex,
    isFlipped: false,
    isComplete: without.length === 0,
    cardsCompleted: state.cardsCompleted + 1,
    firstPassCorrect: state.firstPassCorrect + (known ? 1 : 0),
    sessionAnswers: [...state.sessionAnswers, { cardId: item.card.id, known }],
  }
}

function createUndoSnapshot(state: TestSessionState): TestUndoSnapshot {
  return {
    queue: state.queue,
    currentIndex: state.currentIndex,
    cards: state.cards,
    isFlipped: state.isFlipped,
    isComplete: state.isComplete,
    cardsCompleted: state.cardsCompleted,
    firstPassCorrect: state.firstPassCorrect,
    sessionAnswers: state.sessionAnswers,
  }
}

function withUndo(state: TestSessionState): TestSessionState {
  return {
    ...state,
    undoStack: [...state.undoStack, createUndoSnapshot(state)],
  }
}

function testReducer(state: TestSessionState, action: TestAction): TestSessionState {
  switch (action.type) {
    case "FLIP":
      return state.isFlipped ? state : { ...state, isFlipped: true }
    case "UNFLIP":
      return state.isFlipped ? { ...state, isFlipped: false } : state
    case "MARK_REMEMBERED": {
      if (!state.isFlipped) return state
      const withHistory = withUndo(state)
      return state.mode === "check"
        ? handleCheckAnswer(withHistory, true)
        : handlePracticeRemembered(withHistory)
    }
    case "MARK_FORGOT": {
      if (!state.isFlipped) return state
      const withHistory = withUndo(state)
      return state.mode === "check"
        ? handleCheckAnswer(withHistory, false)
        : handlePracticeForgot(withHistory)
    }
    case "GO_BACK": {
      if (state.undoStack.length === 0) return state
      const undoStack = [...state.undoStack]
      const snapshot = undoStack.pop()!
      return {
        ...state,
        ...snapshot,
        undoStack,
      }
    }
    default:
      return state
  }
}

/** Cards that still need sorting in a knowledge check (excludes already-learned). */
export { getKnowledgeCheckPool } from "../lib/spaced-repetition"

function buildInitialState(cards: Card[], options: UseTestSessionOptions): TestSessionState {
  const seen = new Set(options.seenCardIds ?? [])

  if (options.mode === "check") {
    const pool = getKnowledgeCheckPool(cards)
    const eligible = pool.filter((card) => !seen.has(card.id))
    const queue = shuffle(eligible.map((card) => ({ card })))
    const initialSeenCount = pool.filter((card) => seen.has(card.id)).length
    return {
      mode: "check",
      cards,
      queue,
      currentIndex: 0,
      isFlipped: false,
      isComplete: queue.length === 0,
      sessionStartTime: Date.now(),
      cardsCompleted: 0,
      totalCards: pool.length,
      firstPassCorrect: 0,
      sessionAnswers: [],
      initialSeenCount,
      undoStack: [],
    }
  }

  const queue = shuffle(cards.map((card) => ({ card })))
  return {
    mode: "practice",
    cards,
    queue,
    currentIndex: 0,
    isFlipped: false,
    isComplete: queue.length === 0,
    sessionStartTime: Date.now(),
    cardsCompleted: 0,
    totalCards: cards.length,
    firstPassCorrect: 0,
    sessionAnswers: [],
    initialSeenCount: 0,
    undoStack: [],
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface TestSessionStats {
  accuracy: number
  durationMinutes: number
  avgSecondsPerCard: number
  cardsTotal: number
  knownCount: number
  testMode: TestMode
}

export interface TestSessionResult {
  state: TestSessionState
  cards: Card[]
  /** English-facing session card for FlashCard (sessionType 2). */
  currentCard: SessionCard | null
  flip: () => void
  unflip: () => void
  markRemembered: () => void
  markForgot: () => void
  goToPrevious: () => void
  canGoBack: boolean
  progress: number
  getSessionStats: () => TestSessionStats
  /** All card IDs seen in this knowledge check (prior progress + this session). */
  getAllSeenCardIds: () => string[]
}

export function useTestSession(cards: Card[], options: UseTestSessionOptions): TestSessionResult {
  const initialState = useMemo(
    () => buildInitialState(cards, options),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [state, dispatch] = useReducer(testReducer, initialState)

  const currentCard = useMemo((): SessionCard | null => {
    const item = state.queue[state.currentIndex]
    if (!item) return null
    return {
      card: item.card,
      sessionType: 2,
      originalCardType: item.card.cardType,
      wrongStreakInLoop: 0,
    }
  }, [state.queue, state.currentIndex])

  const progress =
    state.mode === "check"
      ? state.totalCards === 0
        ? 1
        : Math.min(1, (state.initialSeenCount + state.cardsCompleted) / state.totalCards)
      : state.totalCards === 0
        ? 1
        : Math.min(1, state.cardsCompleted / state.totalCards)

  const getSessionStats = (): TestSessionStats => {
    const durationMs = Date.now() - state.sessionStartTime
    const durationMinutes = Math.max(1, Math.round(durationMs / 60_000))
    const durationSeconds = Math.round(durationMs / 1000)
    const cardsAnswered = state.cardsCompleted
    return {
      accuracy:
        cardsAnswered === 0
          ? 0
          : Math.round((state.firstPassCorrect / cardsAnswered) * 100),
      durationMinutes,
      avgSecondsPerCard:
        cardsAnswered === 0 ? 0 : Math.round(durationSeconds / cardsAnswered),
      cardsTotal: state.mode === "check" ? cardsAnswered : state.totalCards,
      knownCount: state.firstPassCorrect,
      testMode: state.mode,
    }
  }

  const getAllSeenCardIds = (): string[] => {
    const prior = options.seenCardIds ?? []
    const session = state.sessionAnswers.map((answer) => answer.cardId)
    return [...new Set([...prior, ...session])]
  }

  return {
    state,
    cards: state.cards,
    currentCard,
    flip: () => dispatch({ type: "FLIP" }),
    unflip: () => dispatch({ type: "UNFLIP" }),
    markRemembered: () => dispatch({ type: "MARK_REMEMBERED" }),
    markForgot: () => dispatch({ type: "MARK_FORGOT" }),
    goToPrevious: () => dispatch({ type: "GO_BACK" }),
    canGoBack: state.undoStack.length > 0,
    progress,
    getSessionStats,
    getAllSeenCardIds,
  }
}
