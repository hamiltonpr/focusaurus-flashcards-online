import type { Card } from "../types"

/** Returns the next interval (days) to use after a successful review.
 *  Schedule: 0→1→2→4→8→16→... (gaps double each time)
 *  Review days from first learning: 1, 3, 7, 15, 31, 63...
 */
export function getNextInterval(currentInterval: number): number {
  return currentInterval === 0 ? 1 : currentInterval * 2
}

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0]
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(dateString + "T00:00:00")
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]
}

export function isCardDueToday(card: Card): boolean {
  if (!card.nextReviewDate) return false
  return card.nextReviewDate <= getTodayString()
}

export function countDueCards(cards: Card[]): number {
  return cards.filter(isCardDueToday).length
}

/** Human-readable label for when a card is scheduled next. */
export function formatNextReviewLabel(nextReviewDate?: string): string | null {
  if (!nextReviewDate) return null
  const today = getTodayString()
  if (nextReviewDate < today) {
    const parsed = new Date(`${nextReviewDate}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) return null
    const formatted = parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    return `Overdue since ${formatted}`
  }
  if (nextReviewDate === today) return "Due for review today"
  const tomorrow = addDays(today, 1)
  if (nextReviewDate === tomorrow) return "Next review: tomorrow"
  const parsed = new Date(`${nextReviewDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  const formatted = parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `Next review: ${formatted}`
}

/** Mark a card as already known — same as "Mark as learned" on the edit screen. */
export function markCardAsLearned(card: Card): Card {
  const interval = Math.floor(Math.random() * (365 - 7 + 1)) + 7
  const nextReviewDate = addDays(getTodayString(), interval)
  return { ...card, cardType: 2, interval, nextReviewDate }
}

/** Mark a card as still learning — clears learned scheduling. */
export function markCardAsStillLearning(card: Card): Card {
  return { ...card, cardType: 1, interval: 0, nextReviewDate: undefined }
}

export function applyKnowledgeCheckAnswer(cards: Card[], cardId: string, known: boolean): Card[] {
  return cards.map((card) => {
    if (card.id !== cardId) return card
    return known ? markCardAsLearned(card) : markCardAsStillLearning(card)
  })
}

/** Unlearned cards that can still be sorted in a knowledge check. */
export function getKnowledgeCheckPool(cards: Card[]): Card[] {
  return cards.filter((card) => card.cardType !== 2)
}

/** Ensure legacy cards (no spaced-repetition fields) have defaults. */
export function migrateCard(card: Partial<Card> & { id: string; front: string; back: string }): Card {
  return {
    ...card,
    cardType: card.cardType ?? 1,
    interval: card.interval ?? 0,
    nextReviewDate: card.nextReviewDate,
  }
}
