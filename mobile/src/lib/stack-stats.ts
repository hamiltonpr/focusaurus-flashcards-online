import type { Stack, TestSessionSummary, TestStatsBucket, Card } from "../types"
import { getTodayString } from "./spaced-repetition"

export const EMPTY_TEST_STATS: TestStatsBucket = {
  sessionsCount: 0,
  accuracy: 0,
  durationMinutes: 0,
  avgSecondsPerCard: 0,
  totalCardsTested: 0,
}

export function mergeTestSessionIntoStack(stack: Stack, session: TestSessionSummary): Stack {
  const today = getTodayString()
  const prevToday = stack.todayTestStats ?? EMPTY_TEST_STATS
  const prevAllTime = stack.allTimeTestStats ?? EMPTY_TEST_STATS
  const sameDay = stack.lastTestSession?.completedAt === today

  const todayTotalCards =
    (sameDay ? prevToday.totalCardsTested : 0) + session.cardsTotal
  const todayDuration = (sameDay ? prevToday.durationMinutes : 0) + session.durationMinutes
  const todaySessions = sameDay ? prevToday.sessionsCount + 1 : 1

  const todayTestStats: TestStatsBucket = {
    sessionsCount: todaySessions,
    accuracy:
      todayTotalCards > 0
        ? Math.round(
            ((sameDay ? prevToday.accuracy * prevToday.totalCardsTested : 0) +
              session.accuracy * session.cardsTotal) /
              todayTotalCards,
          )
        : session.accuracy,
    durationMinutes: todayDuration,
    avgSecondsPerCard:
      todayTotalCards > 0 ? Math.round((todayDuration * 60) / todayTotalCards) : 0,
    totalCardsTested: todayTotalCards,
  }

  const allTimeTotalCards = prevAllTime.totalCardsTested + session.cardsTotal
  const allTimeDuration = prevAllTime.durationMinutes + session.durationMinutes
  const allTimeSessions = prevAllTime.sessionsCount + 1

  const allTimeTestStats: TestStatsBucket = {
    sessionsCount: allTimeSessions,
    accuracy:
      allTimeTotalCards > 0
        ? Math.round(
            (prevAllTime.accuracy * prevAllTime.totalCardsTested +
              session.accuracy * session.cardsTotal) /
              allTimeTotalCards,
          )
        : session.accuracy,
    durationMinutes: allTimeDuration,
    avgSecondsPerCard:
      allTimeTotalCards > 0 ? Math.round((allTimeDuration * 60) / allTimeTotalCards) : 0,
    totalCardsTested: allTimeTotalCards,
  }

  return {
    ...stack,
    lastTestSession: session,
    knowledgeCheckProgress: session.testMode === "check" ? undefined : stack.knowledgeCheckProgress,
    todayTestStats,
    allTimeTestStats,
  }
}

export function saveKnowledgeCheckProgress(
  stack: Stack,
  seenCardIds: string[],
  cards?: Card[],
): Stack {
  const base = cards ? { ...stack, cards } : stack
  if (seenCardIds.length === 0) {
    const { knowledgeCheckProgress: _, ...rest } = base
    return rest
  }
  return {
    ...base,
    knowledgeCheckProgress: { seenCardIds },
  }
}
