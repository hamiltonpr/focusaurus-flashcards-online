import { useReducer, useMemo } from "react"
import type { Card, Stack, StudyGoal, GlobalSettings, StackSettings } from "../types"
import { getNextInterval, getTodayString, addDays, isCardDueToday } from "../lib/spaced-repetition"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionCard {
  card: Card
  /** How the card is currently being presented in this session */
  sessionType: 1 | 2
  /** Original type when the session started (never changes) */
  originalCardType: 1 | 2
  /** Consecutive wrong answers as type-2 in the active loop */
  wrongStreakInLoop: number
  /** Timestamp when first answered correctly (used for end-of-day ordering) */
  firstCorrectTimestamp?: number
}

export type SessionPhase = "loop" | "short-term" | "end-of-day" | "complete"

export interface SessionState {
  phase: SessionPhase
  /** After short-term phase, return to loop (false = proceed to end-of-day) */
  shortTermReturnsToLoop: boolean
  isWindingDown: boolean
  isFlipped: boolean

  loopCards: SessionCard[]
  currentLoopIndex: number

  /** New (unlearned) cards waiting to enter the loop */
  pendingType1: Card[]
  /** Spaced-review cards due today waiting to enter the loop */
  pendingType2Spaced: SessionCard[]
  /** Failed short-term cards — highest priority for entering loop */
  pendingType2Failed: SessionCard[]

  /** Cards that passed loop as type-2, waiting for batch review */
  shortTermQueue: SessionCard[]
  /** Cards currently being reviewed in the short-term phase */
  shortTermReviewCards: SessionCard[]
  shortTermReviewIndex: number

  /** Cards that passed short-term review, awaiting end-of-day */
  endOfDayPile: SessionCard[]
  endOfDayIndex: number

  /** How many type-1 cards have entered the short-term queue (word goal tracking) */
  type1EnteredShortTerm: number
  /** Total cards that have exited the loop (for progress bar) */
  cardsExitedLoop: number
  sessionStartTime: number

  config: {
    loopSize: number
    shortTermSize: number
    wrongStreakLimit: number
    priority: "new-words" | "solidify"
    goal: StudyGoal
  }
}

type SessionAction =
  | { type: "FLIP" }
  | { type: "UNFLIP" }
  | { type: "MARK_KNOWN" }
  | { type: "MARK_UNKNOWN" }
  | { type: "JUMP_TO_SHORT_TERM" }
  | { type: "JUMP_TO_END_OF_DAY" }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countType1InLoop(loop: SessionCard[]): number {
  return loop.filter((c) => c.originalCardType === 1).length
}

function hasSpacedCardInLoop(loop: SessionCard[]): boolean {
  return loop.some((c) => c.originalCardType === 2 && c.card.nextReviewDate !== undefined)
}

/** Pick the next card to fill an empty loop slot. */
function getNextLoopCard(state: SessionState): SessionCard | null {
  const { pendingType2Failed, pendingType2Spaced, pendingType1, loopCards, config } = state

  // Priority 1: failed short-term cards (always trump)
  if (pendingType2Failed.length > 0) {
    return pendingType2Failed[0]
  }

  const type1Count = countType1InLoop(loopCards)
  const needsType1 = type1Count < 2

  // Always maintain at least 2 type-1 slots
  if (needsType1 && pendingType1.length > 0) {
    return makeSessionCard(pendingType1[0], 1, 1)
  }

  // Apply priority preference
  if (config.priority === "new-words") {
    if (pendingType1.length > 0) return makeSessionCard(pendingType1[0], 1, 1)
    if (pendingType2Spaced.length > 0) return pendingType2Spaced[0]
  } else {
    if (pendingType2Spaced.length > 0) return pendingType2Spaced[0]
    if (pendingType1.length > 0) return makeSessionCard(pendingType1[0], 1, 1)
  }

  return null
}

function makeSessionCard(card: Card, sessionType: 1 | 2, originalCardType: 1 | 2): SessionCard {
  return { card, sessionType, originalCardType, wrongStreakInLoop: 0 }
}

/** Remove the first occurrence of a card from a queue, returning new queue. */
function removeFirst<T>(arr: T[], predicate: (item: T) => boolean): T[] {
  const idx = arr.findIndex(predicate)
  if (idx === -1) return arr
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)]
}

/** Consume the card that was just selected by getNextLoopCard from its source queue. */
function consumeNextLoopCard(state: SessionState): SessionState {
  const { pendingType2Failed, pendingType2Spaced, pendingType1, loopCards, config } = state

  if (pendingType2Failed.length > 0) {
    return { ...state, pendingType2Failed: pendingType2Failed.slice(1) }
  }

  const type1Count = countType1InLoop(loopCards)
  const needsType1 = type1Count < 2

  if (needsType1 && pendingType1.length > 0) {
    return { ...state, pendingType1: pendingType1.slice(1) }
  }

  if (config.priority === "new-words") {
    if (pendingType1.length > 0) return { ...state, pendingType1: pendingType1.slice(1) }
    if (pendingType2Spaced.length > 0) return { ...state, pendingType2Spaced: pendingType2Spaced.slice(1) }
  } else {
    if (pendingType2Spaced.length > 0) return { ...state, pendingType2Spaced: pendingType2Spaced.slice(1) }
    if (pendingType1.length > 0) return { ...state, pendingType1: pendingType1.slice(1) }
  }

  return state
}

function checkTimeGoal(state: SessionState): boolean {
  if (state.config.goal.type !== "time") return false
  const elapsed = Date.now() - state.sessionStartTime
  const estimated = (state.shortTermQueue.length + state.endOfDayPile.length) * 1500
  return elapsed + estimated >= state.config.goal.target * 60_000
}

function checkWordGoalWinddown(state: SessionState, type1Count: number): boolean {
  if (state.config.goal.type !== "words") return false
  if (type1Count < state.config.goal.target) return false
  // Also need all spaced review cards to be gone
  return state.pendingType2Spaced.length === 0 && !hasSpacedCardInLoop(state.loopCards)
}

function enterShortTermPhase(state: SessionState, returnsToLoop: boolean): SessionState {
  return {
    ...state,
    phase: "short-term",
    shortTermReturnsToLoop: returnsToLoop,
    shortTermReviewCards: [...state.shortTermQueue],
    shortTermQueue: [],
    shortTermReviewIndex: 0,
    isFlipped: false,
  }
}

function enterEndOfDayPhase(state: SessionState): SessionState {
  const sorted = [...state.endOfDayPile].sort(
    (a, b) => (a.firstCorrectTimestamp ?? 0) - (b.firstCorrectTimestamp ?? 0),
  )
  return {
    ...state,
    phase: "end-of-day",
    endOfDayPile: sorted,
    endOfDayIndex: 0,
    isFlipped: false,
  }
}

/** After removing a card from loop position idx, fill the slot or shrink the loop. */
function fillOrShrinkLoop(
  state: SessionState,
  removedIdx: number,
): { newState: SessionState; newIndex: number } {
  const next = getNextLoopCard(state)
  if (next) {
    let s = consumeNextLoopCard(state)
    const newLoop = [...s.loopCards]
    newLoop[removedIdx] = next
    s = { ...s, loopCards: newLoop }
    // Don't advance — the replacement card is now at removedIdx and will be shown next cycle
    const newIndex = (removedIdx + 1) % newLoop.length
    return { newState: s, newIndex }
  } else {
    // Shrink
    const newLoop = state.loopCards.filter((_, i) => i !== removedIdx)
    const newIndex = newLoop.length === 0 ? 0 : removedIdx % newLoop.length
    return { newState: { ...state, loopCards: newLoop }, newIndex }
  }
}

function advanceLoopIndex(state: SessionState): number {
  if (state.loopCards.length === 0) return 0
  return (state.currentLoopIndex + 1) % state.loopCards.length
}

// ---------------------------------------------------------------------------
// Phase handlers
// ---------------------------------------------------------------------------

function handleLoopKnown(state: SessionState): SessionState {
  const card = state.loopCards[state.currentLoopIndex]

  if (card.sessionType === 1) {
    // Promote to type-2 in the loop — stays in loop but flips direction
    const newLoop = [...state.loopCards]
    newLoop[state.currentLoopIndex] = { ...card, sessionType: 2, wrongStreakInLoop: 0 }
    const next = advanceLoopIndex({ ...state, loopCards: newLoop })
    return checkAndMaybeWindDown({ ...state, loopCards: newLoop, currentLoopIndex: next, isFlipped: false })
  }

  // type-2 correct → remove from loop, add to short-term queue
  const now = Date.now()
  const updatedCard: SessionCard = { ...card, firstCorrectTimestamp: card.firstCorrectTimestamp ?? now }

  const newShortTermQueue = [...state.shortTermQueue, updatedCard]

  let s = { ...state, shortTermQueue: newShortTermQueue, cardsExitedLoop: state.cardsExitedLoop + 1 }

  // Track word goal
  let type1Count = s.type1EnteredShortTerm
  if (card.originalCardType === 1) {
    type1Count++
    s = { ...s, type1EnteredShortTerm: type1Count }
  }

  // Fill/shrink the loop slot
  const { newState: s2, newIndex } = fillOrShrinkLoop(s, s.currentLoopIndex)
  s = { ...s2, currentLoopIndex: newIndex, isFlipped: false }

  // Mark wind-down if word goal just hit AND no more spaced review pending/in-loop
  if (!s.isWindingDown && checkWordGoalWinddown(s, type1Count)) {
    s = { ...s, isWindingDown: true }
  }

  // Trigger short-term batch review if threshold reached
  if (s.shortTermQueue.length >= s.config.shortTermSize) {
    return enterShortTermPhase(s, !s.isWindingDown)
  }

  // If winding down and no spaced review left, flush short-term now (even if < threshold)
  if (s.isWindingDown && s.pendingType2Spaced.length === 0 && !hasSpacedCardInLoop(s.loopCards)) {
    if (s.shortTermQueue.length > 0) return enterShortTermPhase(s, false)
    if (s.endOfDayPile.length > 0) return enterEndOfDayPhase(s)
    return { ...s, phase: "complete" }
  }

  // Check time goal
  if (checkTimeGoal(s)) {
    s = { ...s, isWindingDown: true }
    // Reset remaining loop cards as if not studied
    s = resetLoopCards(s)
    if (s.shortTermQueue.length > 0) return enterShortTermPhase(s, false)
    if (s.endOfDayPile.length > 0) return enterEndOfDayPhase(s)
    return { ...s, phase: "complete" }
  }

  // Loop exhausted
  if (s.loopCards.length === 0) {
    if (s.shortTermQueue.length > 0) return enterShortTermPhase(s, false)
    if (s.endOfDayPile.length > 0) return enterEndOfDayPhase(s)
    return { ...s, phase: "complete" }
  }

  return s
}

function handleLoopUnknown(state: SessionState): SessionState {
  const card = state.loopCards[state.currentLoopIndex]

  if (card.sessionType === 1) {
    // Stays type-1, just advance
    const next = advanceLoopIndex(state)
    return checkAndMaybeWindDown({ ...state, currentLoopIndex: next, isFlipped: false })
  }

  // type-2 wrong — increment streak
  const newStreak = card.wrongStreakInLoop + 1
  const newLoop = [...state.loopCards]

  if (newStreak >= state.config.wrongStreakLimit) {
    // Revert to type-1
    newLoop[state.currentLoopIndex] = { ...card, sessionType: 1, wrongStreakInLoop: 0 }
  } else {
    newLoop[state.currentLoopIndex] = { ...card, wrongStreakInLoop: newStreak }
  }

  const next = advanceLoopIndex({ ...state, loopCards: newLoop })
  return checkAndMaybeWindDown({ ...state, loopCards: newLoop, currentLoopIndex: next, isFlipped: false })
}

function checkAndMaybeWindDown(state: SessionState): SessionState {
  if (!state.isWindingDown && checkTimeGoal(state)) {
    const s = resetLoopCards({ ...state, isWindingDown: true })
    if (s.shortTermQueue.length > 0) return enterShortTermPhase(s, false)
    if (s.endOfDayPile.length > 0) return enterEndOfDayPhase(s)
    return { ...s, phase: "complete" }
  }
  return state
}

function resetLoopCards(state: SessionState): SessionState {
  // Cards still in the loop are discarded as if the session never happened for them.
  // They don't go anywhere — they'll appear again next session as normal.
  return { ...state, loopCards: [] }
}

function handleShortTermKnown(state: SessionState): SessionState {
  const card = state.shortTermReviewCards[state.shortTermReviewIndex]
  const now = Date.now()
  const completed = { ...card, firstCorrectTimestamp: card.firstCorrectTimestamp ?? now }

  const newEndOfDay = [...state.endOfDayPile, completed]
  const nextIdx = state.shortTermReviewIndex + 1

  if (nextIdx >= state.shortTermReviewCards.length) {
    // Batch done
    return afterShortTermBatch({ ...state, endOfDayPile: newEndOfDay })
  }

  return { ...state, endOfDayPile: newEndOfDay, shortTermReviewIndex: nextIdx, isFlipped: false }
}

function handleShortTermUnknown(state: SessionState): SessionState {
  const card = state.shortTermReviewCards[state.shortTermReviewIndex]
  // Failed → goes to front of pendingType2Failed (highest priority back into loop)
  const newFailed = [card, ...state.pendingType2Failed]
  const nextIdx = state.shortTermReviewIndex + 1

  if (nextIdx >= state.shortTermReviewCards.length) {
    return afterShortTermBatch({ ...state, pendingType2Failed: newFailed })
  }

  return { ...state, pendingType2Failed: newFailed, shortTermReviewIndex: nextIdx, isFlipped: false }
}

function afterShortTermBatch(state: SessionState): SessionState {
  if (state.shortTermReturnsToLoop && !state.isWindingDown) {
    // Check time goal before returning
    if (checkTimeGoal(state)) {
      const s = resetLoopCards({ ...state, isWindingDown: true })
      if (s.endOfDayPile.length > 0) return enterEndOfDayPhase(s)
      return { ...s, phase: "complete" }
    }
    return { ...state, phase: "loop", shortTermReviewCards: [], isFlipped: false }
  }

  // Wind-down: go to end-of-day
  if (state.endOfDayPile.length > 0) return enterEndOfDayPhase(state)
  return { ...state, phase: "complete" }
}

function handleEndOfDayKnown(state: SessionState): SessionState {
  const card = state.endOfDayPile[state.endOfDayIndex]
  const nextInterval = getNextInterval(card.card.interval)
  const today = getTodayString()
  const updatedCard: Card = {
    ...card.card,
    cardType: 2,
    interval: nextInterval,
    nextReviewDate: addDays(today, nextInterval),
  }

  const newPile = [...state.endOfDayPile]
  newPile[state.endOfDayIndex] = { ...card, card: updatedCard }

  const nextIdx = state.endOfDayIndex + 1
  if (nextIdx >= newPile.length) {
    return { ...state, endOfDayPile: newPile, endOfDayIndex: nextIdx, phase: "complete", isFlipped: false }
  }
  return { ...state, endOfDayPile: newPile, endOfDayIndex: nextIdx, isFlipped: false }
}

function handleEndOfDayUnknown(state: SessionState): SessionState {
  const card = state.endOfDayPile[state.endOfDayIndex]
  // Reset interval to 1 — show again tomorrow as type-2
  const updatedCard: Card = {
    ...card.card,
    cardType: 2,
    interval: 1,
    nextReviewDate: addDays(getTodayString(), 1),
  }

  const newPile = [...state.endOfDayPile]
  newPile[state.endOfDayIndex] = { ...card, card: updatedCard }

  const nextIdx = state.endOfDayIndex + 1
  if (nextIdx >= newPile.length) {
    return { ...state, endOfDayPile: newPile, endOfDayIndex: nextIdx, phase: "complete", isFlipped: false }
  }
  return { ...state, endOfDayPile: newPile, endOfDayIndex: nextIdx, isFlipped: false }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "FLIP":
      return state.isFlipped ? state : { ...state, isFlipped: true }

    case "UNFLIP":
      return state.isFlipped ? { ...state, isFlipped: false } : state

    case "MARK_KNOWN":
      if (!state.isFlipped) return state
      if (state.phase === "loop") return handleLoopKnown(state)
      if (state.phase === "short-term") return handleShortTermKnown(state)
      if (state.phase === "end-of-day") return handleEndOfDayKnown(state)
      return state

    case "MARK_UNKNOWN":
      if (!state.isFlipped) return state
      if (state.phase === "loop") return handleLoopUnknown(state)
      if (state.phase === "short-term") return handleShortTermUnknown(state)
      if (state.phase === "end-of-day") return handleEndOfDayUnknown(state)
      return state

    case "JUMP_TO_SHORT_TERM":
      if (state.shortTermQueue.length === 0) return state
      if (state.phase === "short-term" || state.phase === "complete") return state
      return enterShortTermPhase(state, state.phase === "loop" && !state.isWindingDown)

    case "JUMP_TO_END_OF_DAY":
      if (state.phase === "end-of-day" || state.phase === "complete") return state
      let windingDown: SessionState = { ...state, isWindingDown: true, isFlipped: false }
      windingDown = resetLoopCards(windingDown)
      if (windingDown.phase === "short-term") {
        windingDown = {
          ...windingDown,
          shortTermReviewCards: [],
          shortTermReviewIndex: 0,
        }
      }
      if (windingDown.endOfDayPile.length > 0) return enterEndOfDayPhase(windingDown)
      return { ...windingDown, phase: "complete" }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Initializer
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: StackSettings = { loopSize: 4, shortTermSize: 5, wrongStreakLimit: 3 }

function buildInitialState(stack: Stack, goal: StudyGoal, globalSettings: GlobalSettings): SessionState {
  const settings = stack.stackSettings ?? DEFAULT_SETTINGS

  const dueCards: SessionCard[] = stack.cards
    .filter(isCardDueToday)
    .map((c) => makeSessionCard(c, 2, 2))

  const newCards: Card[] = stack.cards.filter((c) => c.cardType === 1 && !isCardDueToday(c))

  // Fill loop with 1,2,1,2 pattern (fall back to available cards)
  const pendingType1 = [...newCards]
  const pendingType2 = [...dueCards]
  const loopCards: SessionCard[] = []
  const pattern: Array<1 | 2> = [1, 2, 1, 2]

  for (let i = 0; i < settings.loopSize; i++) {
    const want = pattern[i % pattern.length]
    if (want === 1 && pendingType1.length > 0) {
      loopCards.push(makeSessionCard(pendingType1.shift()!, 1, 1))
    } else if (want === 2 && pendingType2.length > 0) {
      loopCards.push(pendingType2.shift()!)
    } else if (pendingType1.length > 0) {
      loopCards.push(makeSessionCard(pendingType1.shift()!, 1, 1))
    } else if (pendingType2.length > 0) {
      loopCards.push(pendingType2.shift()!)
    } else {
      break // no more cards
    }
  }

  return {
    phase: "loop",
    shortTermReturnsToLoop: true,
    isWindingDown: false,
    isFlipped: false,
    loopCards,
    currentLoopIndex: 0,
    pendingType1,
    pendingType2Spaced: pendingType2,
    pendingType2Failed: [],
    shortTermQueue: [],
    shortTermReviewCards: [],
    shortTermReviewIndex: 0,
    endOfDayPile: [],
    endOfDayIndex: 0,
    type1EnteredShortTerm: 0,
    cardsExitedLoop: 0,
    sessionStartTime: Date.now(),
    config: {
      loopSize: settings.loopSize,
      shortTermSize: settings.shortTermSize,
      wrongStreakLimit: settings.wrongStreakLimit,
      priority: globalSettings.priority,
      goal,
    },
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface StudySessionResult {
  state: SessionState
  currentCard: SessionCard | null
  flip: () => void
  unflip: () => void
  markKnown: () => void
  jumpToShortTerm: () => void
  jumpToEndOfDay: () => void
  markUnknown: () => void
  getUpdatedCards: () => Card[]
  /** For word goal: 0–1 fraction of goal reached. For time goal: unused. */
  sessionProgress: number
  /** For word goal: goal.target. For time goal: total planned cards today. */
  totalSessionCards: number
  /** Cards that have exited the loop (entered short-term queue) */
  cardsExitedLoop: number
}

export function useStudySession(
  stack: Stack,
  goal: StudyGoal,
  globalSettings: GlobalSettings,
): StudySessionResult {
  const initialState = useMemo(
    () => buildInitialState(stack, goal, globalSettings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [state, dispatch] = useReducer(sessionReducer, initialState)

  const currentCard = useMemo((): SessionCard | null => {
    if (state.phase === "loop") {
      return state.loopCards[state.currentLoopIndex] ?? null
    }
    if (state.phase === "short-term") {
      return state.shortTermReviewCards[state.shortTermReviewIndex] ?? null
    }
    if (state.phase === "end-of-day") {
      return state.endOfDayPile[state.endOfDayIndex] ?? null
    }
    return null
  }, [state])

  const totalSessionCards = useMemo(() => {
    if (initialState.config.goal.type === "words") {
      return initialState.config.goal.target
    }
    // Time goal: total = all cards available today (loop + pending queues)
    return (
      initialState.loopCards.length +
      initialState.pendingType1.length +
      initialState.pendingType2Spaced.length
    )
  }, [initialState])

  const sessionProgress = useMemo(() => {
    if (totalSessionCards === 0) return 1
    if (initialState.config.goal.type === "words") {
      // Progress = type-1 cards that have exited the loop toward the goal
      return Math.min(1, state.type1EnteredShortTerm / totalSessionCards)
    }
    return Math.min(1, state.cardsExitedLoop / Math.max(totalSessionCards, 1))
  }, [state.type1EnteredShortTerm, state.cardsExitedLoop, totalSessionCards, initialState.config.goal.type])

  const getUpdatedCards = (): Card[] => {
    const updatedMap = new Map<string, Card>()
    for (const sc of state.endOfDayPile) {
      updatedMap.set(sc.card.id, sc.card)
    }
    return stack.cards.map((c) => updatedMap.get(c.id) ?? c)
  }

  return {
    state,
    currentCard,
    flip: () => dispatch({ type: "FLIP" }),
    unflip: () => dispatch({ type: "UNFLIP" }),
    markKnown: () => dispatch({ type: "MARK_KNOWN" }),
    markUnknown: () => dispatch({ type: "MARK_UNKNOWN" }),
    jumpToShortTerm: () => dispatch({ type: "JUMP_TO_SHORT_TERM" }),
    jumpToEndOfDay: () => dispatch({ type: "JUMP_TO_END_OF_DAY" }),
    cardsExitedLoop: state.cardsExitedLoop,
    getUpdatedCards,
    sessionProgress,
    totalSessionCards,
  }
}
