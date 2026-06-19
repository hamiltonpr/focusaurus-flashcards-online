import type { Card } from "../types"

let idCounter = 0

export function generateCardId(): string {
  idCounter += 1
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 11)}`
}

/** Drop duplicate card entries that share the same id (e.g. from a double import). */
export function dedupeCardsById(cards: Card[]): Card[] {
  const seen = new Set<string>()
  return cards.filter((card) => {
    if (seen.has(card.id)) return false
    seen.add(card.id)
    return true
  })
}
