import TinySegmenter from "./tiny-segmenter"
import type { Card } from "../../types"
import type { StoryToken } from "./types"

const segmenter = new TinySegmenter()

const PUNCTUATION = /^[\s。、！？…「」『』（）()・：:；;—–\-,.!?'"[\]{}]+$/

function isPunctuation(text: string): boolean {
  return PUNCTUATION.test(text)
}

/** Merge adjacent non-word tokens (whitespace + punctuation) for cleaner rendering. */
function mergeNonWordTokens(tokens: StoryToken[]): StoryToken[] {
  const merged: StoryToken[] = []
  for (const token of tokens) {
    const prev = merged[merged.length - 1]
    if (prev && !prev.isWord && !token.isWord) {
      prev.text += token.text
    } else {
      merged.push({ ...token })
    }
  }
  return merged
}

export function tokenizeJapaneseText(text: string, _stackCards: Card[] = []): StoryToken[] {
  const segments = segmenter.segment(text)
  const tokens: StoryToken[] = []

  for (const segment of segments) {
    if (!segment) continue

    if (isPunctuation(segment)) {
      tokens.push({ text: segment, isWord: false })
      continue
    }

    tokens.push({ text: segment, isWord: true })
  }

  return mergeNonWordTokens(tokens)
}

export function tokenizeFromRubySegments(
  segments: Array<{
    text: string
    reading?: string
    kanjiText?: string
    kanjiReading?: string
    kanjiParts?: Array<{ text: string; reading: string }>
  }>,
  _stackCards: Card[] = [],
): StoryToken[] {
  const tokens: StoryToken[] = []

  for (const segment of segments) {
    if (!segment.text) continue

    if (isPunctuation(segment.text)) {
      tokens.push({ text: segment.text, isWord: false })
      continue
    }

    tokens.push({
      text: segment.text,
      reading: segment.reading,
      kanjiText: segment.kanjiText,
      kanjiReading: segment.kanjiReading,
      kanjiParts: segment.kanjiParts,
      isWord: true,
    })
  }

  return mergeNonWordTokens(tokens)
}

export function extractVocabularyForms(text: string): Set<string> {
  const forms = new Set<string>()
  for (const segment of segmenter.segment(text)) {
    if (segment && !isPunctuation(segment)) forms.add(segment)
  }
  return forms
}
