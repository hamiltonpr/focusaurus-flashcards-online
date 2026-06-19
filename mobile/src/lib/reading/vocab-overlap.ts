import { CURATED_STORIES } from "./curated-stories"
import { extractVocabularyForms } from "./tokenize"
import type { CuratedStory, RankedStory, ReadTime, StoryLevel } from "./types"

const LENGTH_ORDER: ReadTime[] = ["short", "medium", "long"]

function firstLine(text: string): string {
  return text.split("\n")[0]?.trim() ?? text.trim()
}

function normalizeWord(word: string): string {
  return firstLine(word).trim()
}

function levelDistance(storyLevel: StoryLevel, userLevel: StoryLevel): number {
  const order: StoryLevel[] = ["beginner", "intermediate", "advanced"]
  return Math.abs(order.indexOf(storyLevel) - order.indexOf(userLevel))
}

function lengthDistance(storyLength: ReadTime, target: ReadTime): number {
  return Math.abs(LENGTH_ORDER.indexOf(storyLength) - LENGTH_ORDER.indexOf(target))
}

const storyFormsCache = new Map<string, Set<string>>()

function getStoryForms(story: CuratedStory): Set<string> {
  const cached = storyFormsCache.get(story.id)
  if (cached) return cached
  const forms = extractVocabularyForms(story.text)
  storyFormsCache.set(story.id, forms)
  return forms
}

function countOverlap(story: CuratedStory, words: string[]): number {
  if (words.length === 0) return 0
  const forms = getStoryForms(story)
  const text = story.text
  let count = 0
  const seen = new Set<string>()

  for (const raw of words) {
    const word = normalizeWord(raw)
    if (!word || seen.has(word)) continue
    seen.add(word)
    if (forms.has(word) || text.includes(word)) count += 1
  }
  return count
}

export function rankCuratedStories(options: {
  recentWords: string[]
  knownWords: string[]
  level: StoryLevel
  readTime: ReadTime
}): RankedStory[] {
  const { recentWords, knownWords, level, readTime } = options

  return CURATED_STORIES.map((story) => ({
    story,
    recentOverlap: countOverlap(story, recentWords),
    totalOverlap: countOverlap(story, [...recentWords, ...knownWords]),
  }))
    .filter(({ story }) => levelDistance(story.level, level) <= 1)
    .sort((a, b) => {
      if (b.recentOverlap !== a.recentOverlap) return b.recentOverlap - a.recentOverlap
      if (b.totalOverlap !== a.totalOverlap) return b.totalOverlap - a.totalOverlap
      const lenDiff = lengthDistance(a.story.length, readTime) - lengthDistance(b.story.length, readTime)
      if (lenDiff !== 0) return lenDiff
      const levelDiff = levelDistance(a.story.level, level) - levelDistance(b.story.level, level)
      if (levelDiff !== 0) return levelDiff
      // Shuffle ties so the same story doesn't always win when overlap is equal.
      return Math.random() - 0.5
    })
}

export function pickBestCuratedStory(options: {
  recentWords: string[]
  knownWords: string[]
  level: StoryLevel
  readTime: ReadTime
  recentlyReadIds?: string[]
}): CuratedStory {
  const ranked = rankCuratedStories(options)
  if (ranked.length === 0) {
    const fallback = CURATED_STORIES.slice().sort(
      (a, b) =>
        lengthDistance(a.length, options.readTime) - lengthDistance(b.length, options.readTime) ||
        levelDistance(a.level, options.level) - levelDistance(b.level, options.level),
    )
    return fallback[0] ?? CURATED_STORIES[0]
  }

  const recent = new Set(options.recentlyReadIds ?? [])
  const unread = ranked.filter((r) => !recent.has(r.story.id))
  const pool = unread.length > 0 ? unread : ranked

  // Random pick among the top few unread matches so repeats are less likely.
  const shortlist = pool.slice(0, Math.min(4, pool.length))
  const picked = shortlist[Math.floor(Math.random() * shortlist.length)] ?? pool[0]
  return picked.story
}
