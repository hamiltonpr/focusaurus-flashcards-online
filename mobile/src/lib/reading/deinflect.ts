import { GLOSSARY, type GlossEntry } from "./glossary"

/** Map masu-stem final kana (い-row) back to dictionary ending (う-row). */
const I_ROW_TO_U_ROW: Record<string, string> = {
  い: "う",
  き: "く",
  ぎ: "ぐ",
  し: "す",
  ち: "つ",
  に: "ぬ",
  び: "ぶ",
  み: "む",
  り: "る",
}

function addCandidate(seen: Set<string>, out: string[], value: string) {
  if (!value || seen.has(value)) return
  seen.add(value)
  out.push(value)
}

function masuStemToDict(stem: string, seen: Set<string>, out: string[]) {
  if (!stem) return
  const last = stem[stem.length - 1]
  const uRow = I_ROW_TO_U_ROW[last]
  if (uRow) addCandidate(seen, out, stem.slice(0, -1) + uRow)
  addCandidate(seen, out, stem + "る")
}

function stripSuffix(word: string, suffix: string): string | null {
  return word.endsWith(suffix) ? word.slice(0, -suffix.length) : null
}

/** Generate dictionary-form candidates for a conjugated surface form. */
export function generateLookupCandidates(surface: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  addCandidate(seen, out, surface)

  // Progressive: 〜ている / 〜ていました / 〜でいる / 〜ており
  const progressive = surface.match(/^(.+?)([てで])(いる|おり|い|います|いました|いた)$/)
  if (progressive) {
    const [, stem, connector] = progressive
    if (connector === "て") {
      masuStemToDict(stem, seen, out)
      addCandidate(seen, out, stem + "る")
    } else {
      masuStemToDict(stem, seen, out)
      if (stem.endsWith("ん")) addCandidate(seen, out, stem.slice(0, -1) + "む")
      if (stem.endsWith("い")) addCandidate(seen, out, stem.slice(0, -1) + "ぐ")
    }
  }

  // 〜ながら
  const nagara = stripSuffix(surface, "ながら")
  if (nagara) {
    masuStemToDict(nagara, seen, out)
    addCandidate(seen, out, nagara + "る")
  }

  // Polite forms
  for (const suffix of ["ませんでした", "ません", "ましょう", "ました", "ます"]) {
    const stem = stripSuffix(surface, suffix)
    if (stem) masuStemToDict(stem, seen, out)
  }

  // Negative
  for (const suffix of ["なかった", "なくて", "ない"]) {
    const stem = stripSuffix(surface, suffix)
    if (stem) masuStemToDict(stem, seen, out)
  }

  // Ta-form past
  if (surface.endsWith("た")) {
    const stem = surface.slice(0, -1)
    masuStemToDict(stem, seen, out)
    addCandidate(seen, out, stem + "る")
  }
  if (surface.endsWith("だ") && surface.length > 1) {
    const stem = surface.slice(0, -1)
    masuStemToDict(stem, seen, out)
  }

  // Te-form
  if (surface.endsWith("して")) {
    const base = surface.slice(0, -2)
    addCandidate(seen, out, "する")
    if (base) addCandidate(seen, out, base + "する")
  } else if (surface.endsWith("て")) {
    const stem = surface.slice(0, -1)
    masuStemToDict(stem, seen, out)
    addCandidate(seen, out, stem + "る")
  } else if (surface.endsWith("で")) {
    const stem = surface.slice(0, -1)
    masuStemToDict(stem, seen, out)
    if (stem.endsWith("ん")) addCandidate(seen, out, stem.slice(0, -1) + "む")
    if (stem.endsWith("い")) addCandidate(seen, out, stem.slice(0, -1) + "ぐ")
    addCandidate(seen, out, stem + "ぶ")
  }

  // Conditional / volitional / tai
  for (const [suffix, replace] of [
    ["たい", "る"],
    ["たがる", "る"],
    ["られる", "る"],
    ["れる", "る"],
    ["させる", "る"],
    ["せる", "る"],
  ] as const) {
    const stem = stripSuffix(surface, suffix)
    if (stem) addCandidate(seen, out, stem + replace)
  }

  // I-adjective forms
  if (surface.endsWith("かった")) addCandidate(seen, out, surface.slice(0, -3) + "い")
  if (surface.endsWith("くて")) addCandidate(seen, out, surface.slice(0, -2) + "い")
  if (surface.endsWith("く")) addCandidate(seen, out, surface.slice(0, -1) + "い")
  if (surface.endsWith("ければ")) addCandidate(seen, out, surface.slice(0, -3) + "い")
  if (surface.endsWith("い") && surface.length > 1) addCandidate(seen, out, surface)

  // Na-adjective / adnominal 〜な
  if (surface.endsWith("な") && surface.length > 1) {
    addCandidate(seen, out, surface.slice(0, -1))
    addCandidate(seen, out, surface.slice(0, -1) + "だ")
  }

  // 〜そう (looks/seems)
  if (surface.endsWith("そう") && surface.length > 2) {
    addCandidate(seen, out, surface.slice(0, -2))
  }

  // 〜がり (tend to)
  if (surface.endsWith("がり") && surface.length > 2) {
    addCandidate(seen, out, surface.slice(0, -2) + "がる")
  }

  return out
}

function describeInflection(surface: string, base: string): string | undefined {
  if (surface === base) return undefined
  if (surface.endsWith("ました") || surface.endsWith("た")) return "past tense"
  if (surface.endsWith("ます")) return "present tense"
  if (surface.endsWith("て") || surface.endsWith("で")) return "te-form"
  if (surface.endsWith("ない")) return "negative"
  if (surface.endsWith("な")) return "adjective form"
  if (surface.endsWith("かった") || surface.endsWith("く")) return "adjective form"
  if (surface.includes("いる") || surface.includes("いた")) return "progressive"
  if (surface.endsWith("たい")) return "want to"
  return `form of ${base}`
}

export function lookupGlossWithDeinflection(word: string): GlossEntry | undefined {
  const candidates = generateLookupCandidates(word)
  for (const candidate of candidates) {
    const entry = GLOSSARY[candidate]
    if (!entry) continue
    if (candidate === word) return entry
    const note = describeInflection(word, candidate)
    return {
      reading: entry.reading,
      definition: note ? `${entry.definition} (${note})` : entry.definition,
    }
  }
  return undefined
}
