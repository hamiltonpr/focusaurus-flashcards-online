import { generateLookupCandidates, lookupGlossWithDeinflection } from "./deinflect"
import type { Card } from "../../types"

export interface DictionaryEntry {
  reading?: string
  definition: string
  source: "stack" | "particle" | "glossary" | "jisho" | "cache"
}

const PARTICLE_GLOSSES: Record<string, string> = {
  "は": "(topic marker)",
  "が": "(subject marker)",
  "を": "(object marker)",
  "に": "(to / at / in)",
  "で": "(at / by / with)",
  "も": "(also / too)",
  "の": "(possessive / of)",
  "と": "(and / with)",
  "から": "(from / because)",
  "まで": "(until / as far as)",
  "へ": "(toward)",
  "か": "(question)",
  "よ": "(emphasis)",
  "ね": "(isn't it?)",
  "より": "(than / from)",
  "など": "(such as / etc.)",
  "ので": "(because / since)",
  "のに": "(although / despite)",
  "けれど": "(but / however)",
  "けれども": "(but / however)",
}

const memoryCache = new Map<string, DictionaryEntry>()

function firstLine(text: string): string {
  return text.split("\n")[0]?.trim() ?? text.trim()
}

function lookupStack(word: string, cards: Card[]): DictionaryEntry | null {
  const lower = word.toLowerCase()
  for (const card of cards) {
    const front = firstLine(card.front)
    const back = firstLine(card.back)
    if (front.toLowerCase() === lower) {
      return { reading: undefined, definition: back, source: "stack" }
    }
    if (back.toLowerCase() === lower) {
      return { reading: undefined, definition: front, source: "stack" }
    }
  }
  return null
}

interface JishoResponse {
  data?: Array<{
    japanese?: Array<{ word?: string; reading?: string }>
    senses?: Array<{ english_definitions?: string[] }>
  }>
}

function pickJapaneseForm(
  keyword: string,
  forms: Array<{ word?: string; reading?: string }>,
): { word?: string; reading?: string } | undefined {
  if (forms.length === 0) return undefined
  return (
    forms.find((f) => f.word === keyword) ??
    forms.find((f) => f.reading === keyword) ??
    forms[0]
  )
}

async function fetchJisho(keyword: string): Promise<DictionaryEntry | null> {
  const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`
  const res = await fetch(url, {
    headers: { "User-Agent": "Focusaurus/1.0 (language learning app)" },
  })
  if (!res.ok) return null

  const json = (await res.json()) as JishoResponse
  const top = json.data?.[0]
  if (!top) return null

  const japanese = pickJapaneseForm(keyword, top.japanese ?? [])
  const defs = top.senses?.[0]?.english_definitions?.filter(Boolean) ?? []
  if (defs.length === 0) return null

  return {
    reading: japanese?.reading ?? japanese?.word,
    definition: defs.slice(0, 3).join("; "),
    source: "jisho",
  }
}

export async function lookupDictionary(word: string, stackCards: Card[] = []): Promise<DictionaryEntry | null> {
  const cached = memoryCache.get(word)
  if (cached) return { ...cached, source: "cache" }

  const fromStack = lookupStack(word, stackCards)
  if (fromStack) {
    const gloss = lookupGlossWithDeinflection(word)
    const entry: DictionaryEntry = {
      ...fromStack,
      reading: gloss?.reading ?? fromStack.reading,
    }
    memoryCache.set(word, entry)
    return entry
  }

  const particle = PARTICLE_GLOSSES[word]
  if (particle) {
    const entry: DictionaryEntry = { reading: word, definition: particle, source: "particle" }
    memoryCache.set(word, entry)
    return entry
  }

  const gloss = lookupGlossWithDeinflection(word)
  if (gloss) {
    const entry: DictionaryEntry = {
      reading: gloss.reading,
      definition: gloss.definition,
      source: "glossary",
    }
    memoryCache.set(word, entry)
    return entry
  }

  for (const candidate of generateLookupCandidates(word)) {
    const particleCandidate = PARTICLE_GLOSSES[candidate]
    if (particleCandidate) continue

    try {
      const result = await fetchJisho(candidate)
      if (result) {
        const entry: DictionaryEntry = {
          reading: result.reading,
          definition:
            candidate !== word ? `${result.definition} (${word} → ${candidate})` : result.definition,
          source: "jisho",
        }
        memoryCache.set(word, entry)
        return entry
      }
    } catch {
      // try next candidate
    }
  }

  return null
}
