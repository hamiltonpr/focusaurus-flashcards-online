import { lookupGloss } from "./glossary"

/** Single-kana tokens that are particles — do not merge onto a preceding ruby segment. */
const PARTICLE_KANA = new Set([
  "は", "が", "を", "に", "で", "も", "の", "と", "て", "た", "か", "よ", "ね", "へ",
  "さ", "な", "ば", "ぞ", "ず", "だ", "で", "や", "わ",
])

function isHiraganaOnly(text: string): boolean {
  return /^[\u3040-\u309F]+$/.test(text)
}

function isKanjiOnly(text: string): boolean {
  return text.length > 0 && /^[\u4E00-\u9FFF々〆ヵヶ]+$/.test(text)
}

const MAX_SPLIT_RUBY_MERGE_LEN = 4

/** True when `next` looks like okurigana continuing a ruby-annotated kanji stem. */
export function shouldMergeOkurigana(
  prev: { text: string; reading?: string },
  next: { text: string; reading?: string },
): boolean {
  if (!prev.reading || next.reading) return false
  if (!isHiraganaOnly(next.text)) return false
  if (next.text.length >= 2) return true
  return next.text.length === 1 && !PARTICLE_KANA.has(next.text)
}

export interface TextReadingSegment {
  text: string
  reading?: string
  kanjiText?: string
  kanjiReading?: string
  kanjiParts?: Array<{ text: string; reading: string }>
}

function kanjiPartsFromSegment(segment: TextReadingSegment): Array<{ text: string; reading: string }> {
  if (segment.kanjiParts?.length) return [...segment.kanjiParts]
  if (segment.reading && isKanjiOnly(segment.text)) {
    return [{ text: segment.text, reading: segment.reading }]
  }
  return []
}

/** NHK often annotates each kanji separately (二+ふた, 人+り) — merge into one word. */
export function mergeSplitRubySegments(segments: TextReadingSegment[]): TextReadingSegment[] {
  const merged: TextReadingSegment[] = []

  for (const segment of segments) {
    const prev = merged[merged.length - 1]
    const canMerge =
      prev &&
      prev.reading &&
      segment.reading &&
      isKanjiOnly(prev.text) &&
      isKanjiOnly(segment.text) &&
      prev.text.length + segment.text.length <= MAX_SPLIT_RUBY_MERGE_LEN

    if (canMerge) {
      const combinedText = prev.text + segment.text
      const concatReading = prev.reading + segment.reading
      const parts = [...kanjiPartsFromSegment(prev), { text: segment.text, reading: segment.reading }]
      prev.text = combinedText
      prev.reading = lookupGloss(combinedText)?.reading ?? concatReading
      prev.kanjiParts = parts
      prev.kanjiText = undefined
      prev.kanjiReading = undefined
    } else {
      const next: TextReadingSegment = { ...segment }
      if (segment.reading && isKanjiOnly(segment.text) && !segment.kanjiParts?.length) {
        next.kanjiText = segment.text
        next.kanjiReading = segment.reading
      }
      merged.push(next)
    }
  }

  return merged
}

/** Join ruby kanji stems with following hiragana okurigana into whole-word tokens. */
export function mergeOkuriganaSegments(segments: TextReadingSegment[]): TextReadingSegment[] {
  const merged: TextReadingSegment[] = []

  for (const segment of segments) {
    const prev = merged[merged.length - 1]
    if (prev && shouldMergeOkurigana(prev, segment)) {
      prev.text += segment.text
      prev.reading = (prev.reading ?? "") + segment.text
    } else {
      const next: TextReadingSegment = { ...segment }
      if (segment.reading) {
        next.kanjiText = segment.text
        next.kanjiReading = segment.reading
      }
      merged.push(next)
    }
  }

  return merged
}

/** Prefer a reading tied to the clicked surface form over a lemma reading. */
export function preferSurfaceReading(
  surface: string,
  surfaceReading?: string,
  lookupReading?: string,
): string | undefined {
  if (surfaceReading) return surfaceReading
  return lookupReading
}
