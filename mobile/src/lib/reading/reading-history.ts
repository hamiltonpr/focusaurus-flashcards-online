import AsyncStorage from "@react-native-async-storage/async-storage"

export interface ReadingHistory {
  curated: string[]
  nhk: string[]
}

const MAX_HISTORY = 30

const EMPTY: ReadingHistory = { curated: [], nhk: [] }

function storageKey(stackId: string): string {
  return `focusaurus-reading-history:${stackId}`
}

export async function loadReadingHistory(stackId: string): Promise<ReadingHistory> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(stackId))
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<ReadingHistory>
    return {
      curated: Array.isArray(parsed.curated) ? parsed.curated : [],
      nhk: Array.isArray(parsed.nhk) ? parsed.nhk : [],
    }
  } catch {
    return { ...EMPTY }
  }
}

export async function markCuratedStoryRead(stackId: string, storyId: string): Promise<ReadingHistory> {
  const history = await loadReadingHistory(stackId)
  const curated = [storyId, ...history.curated.filter((id) => id !== storyId)].slice(0, MAX_HISTORY)
  const next = { ...history, curated }
  await AsyncStorage.setItem(storageKey(stackId), JSON.stringify(next))
  return next
}

export async function markNhkArticleRead(stackId: string, articleId: string): Promise<ReadingHistory> {
  const history = await loadReadingHistory(stackId)
  const nhk = [articleId, ...history.nhk.filter((id) => id !== articleId)].slice(0, MAX_HISTORY)
  const next = { ...history, nhk }
  await AsyncStorage.setItem(storageKey(stackId), JSON.stringify(next))
  return next
}
