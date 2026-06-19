import type { Card } from "../types"
import { generateCardId } from "./card-utils"

export type CsvSeparator = "," | ";" | "\t"

export interface ParsedColumn {
  index: number
  header: string
  sampleValues: string[]
}

export function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = []
  let current = ""
  let insideQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      insideQuotes = !insideQuotes
    } else if (char === separator && !insideQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result.map((cell) => cell.replace(/^"|"$/g, ""))
}

export function detectSeparator(content: string): CsvSeparator {
  const firstLine = content.split("\n")[0] ?? ""
  const commas = (firstLine.match(/,/g) || []).length
  const semicolons = (firstLine.match(/;/g) || []).length
  const tabs = (firstLine.match(/\t/g) || []).length

  if (tabs > commas && tabs > semicolons) return "\t"
  if (semicolons > commas) return ";"
  return ","
}

export function analyzeCsvContent(content: string, hasHeaders: boolean) {
  const separator = detectSeparator(content)
  const lines = content.trim().split("\n")
  if (lines.length === 0) {
    return { separator, columns: [] as ParsedColumn[] }
  }

  const firstLine = parseCSVLine(lines[0], separator)
  const dataLines = lines.slice(hasHeaders ? 1 : 0, Math.min(hasHeaders ? 6 : 5, lines.length))
  const parsedDataLines = dataLines.map((line) => parseCSVLine(line, separator))

  const columns: ParsedColumn[] = []
  for (let i = 0; i < firstLine.length; i++) {
    const header = hasHeaders ? firstLine[i] || `Column ${i + 1}` : `Column ${i + 1}`
    const sampleValues = parsedDataLines.map((line) => line[i] || "").filter((val) => val.length > 0)
    columns.push({ index: i, header, sampleValues: sampleValues.slice(0, 3) })
  }

  return { separator, columns }
}

export function parseCardsFromCsv(
  content: string,
  separator: CsvSeparator,
  hasHeaders: boolean,
  frontColumns: number[],
  backColumns: number[],
): Card[] {
  const lines = content.trim().split("\n")
  const dataLines = lines.slice(hasHeaders ? 1 : 0)
  const cards: Card[] = []

  dataLines.forEach((line, index) => {
    const parts = parseCSVLine(line, separator)
    const frontText = frontColumns
      .map((i) => parts[i] || "")
      .filter(Boolean)
      .join("\n")
    const backText = backColumns
      .map((i) => parts[i] || "")
      .filter(Boolean)
      .join("\n")

    if (frontText && backText) {
      cards.push({
        id: generateCardId(),
        front: frontText,
        back: backText,
        cardType: 1,
        interval: 0,
      })
    }
  })

  return cards
}

export function separatorLabel(separator: CsvSeparator): string {
  if (separator === "\t") return "tab"
  return separator
}
