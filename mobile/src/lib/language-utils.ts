import type { Card, Stack } from "../types"

export function detectLanguage(cards: Card[]): string {
  const sample = cards.slice(0, 15).map((c) => c.front).join("")
  if (/[\u3040-\u9fff]/.test(sample)) return "Japanese"
  if (/[\u0600-\u06ff]/.test(sample)) return "Arabic"
  if (/[\u0400-\u04ff]/.test(sample)) return "Russian"
  if (/[\u0370-\u03ff]/.test(sample)) return "Greek"
  if (/[\u4e00-\u9fff]/.test(sample)) return "Chinese"
  if (/[\u0900-\u097f]/.test(sample)) return "Hindi"
  return "the target language"
}

export function detectLevel(cards: Card[]): "beginner" | "intermediate" | "advanced" {
  const learned = cards.filter((c) => c.cardType === 2)
  if (learned.length < 5) return "beginner"
  const avg = learned.reduce((sum, c) => sum + c.interval, 0) / learned.length
  if (avg < 4) return "beginner"
  if (avg < 16) return "intermediate"
  return "advanced"
}

export function getRecentWords(stack: Stack, withinDays = 5): Card[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - withinDays)
  const cutoffStr = cutoff.toISOString().split("T")[0]
  return stack.cards
    .filter((c) => c.nextReviewDate && c.nextReviewDate >= cutoffStr)
    .sort((a, b) => (b.nextReviewDate ?? "").localeCompare(a.nextReviewDate ?? ""))
}
