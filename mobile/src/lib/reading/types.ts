export interface StoryToken {
  text: string
  reading?: string
  /** Ruby-annotated stem (kanji portion) when okurigana was merged into this token. */
  kanjiText?: string
  kanjiReading?: string
  /** Per-kanji readings when NHK splits furigana across a compound. */
  kanjiParts?: Array<{ text: string; reading: string }>
  definition?: string
  isWord: boolean
}

export interface TokenizedStory {
  title: string
  tokens: StoryToken[]
  source: "curated" | "nhk-easy"
  sourceId?: string
  attribution?: string
}

export type StoryLevel = "beginner" | "intermediate" | "advanced"
export type ReadTime = "short" | "medium" | "long"

export interface CuratedStory {
  id: string
  title: string
  level: StoryLevel
  length: ReadTime
  text: string
  tags: string[]
}

export interface RankedStory {
  story: CuratedStory
  recentOverlap: number
  totalOverlap: number
}

export interface NhkEasyArticle {
  id: string
  title: string
  date: string
  url: string
}
