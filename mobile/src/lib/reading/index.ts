import type { Card } from "../../types"
import { CURATED_STORIES, getCuratedStoryById } from "./curated-stories"
import { fetchNhkEasyArticle, fetchNhkEasyArticles, rankNhkArticles } from "./nhk-easy"
import { tokenizeJapaneseText } from "./tokenize"
import type { CuratedStory, RankedStory, ReadTime, StoryLevel, TokenizedStory } from "./types"
import { pickBestCuratedStory, rankCuratedStories } from "./vocab-overlap"

export type { StoryToken, TokenizedStory, CuratedStory, RankedStory, ReadTime, StoryLevel, NhkEasyArticle } from "./types"
export type { ReadingHistory } from "./reading-history"
export { CURATED_STORIES, getCuratedStoryById }
export { fetchNhkEasyArticles, fetchNhkEasyArticle, rankNhkArticles }
export { rankCuratedStories, pickBestCuratedStory }
export { lookupDictionary, type DictionaryEntry } from "./dictionary"

export function loadCuratedStory(story: CuratedStory, stackCards: Card[] = []): TokenizedStory {
  return {
    title: story.title,
    tokens: tokenizeJapaneseText(story.text, stackCards),
    source: "curated",
    sourceId: story.id,
  }
}

export function loadCuratedStoryById(id: string, stackCards: Card[] = []): TokenizedStory | null {
  const story = getCuratedStoryById(id)
  if (!story) return null
  return loadCuratedStory(story, stackCards)
}

export function pickAndLoadCuratedStory(options: {
  recentWords: string[]
  knownWords: string[]
  level: StoryLevel
  readTime: ReadTime
  stackCards?: Card[]
  recentlyReadIds?: string[]
}): TokenizedStory {
  const story = pickBestCuratedStory(options)
  return loadCuratedStory(story, options.stackCards ?? [])
}

export async function loadBestNhkArticle(options: {
  recentWords: string[]
  knownWords: string[]
  stackCards?: Card[]
}): Promise<TokenizedStory> {
  const articles = await fetchNhkEasyArticles()
  const ranked = rankNhkArticles(articles, options.recentWords, options.knownWords)
  const best = ranked[0] ?? articles[0]
  return fetchNhkEasyArticle(best.id, options.stackCards ?? [])
}

export async function loadNhkArticleById(
  articleId: string,
  stackCards: Card[] = [],
): Promise<TokenizedStory> {
  return fetchNhkEasyArticle(articleId, stackCards)
}
