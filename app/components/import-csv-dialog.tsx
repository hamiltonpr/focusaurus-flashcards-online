"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload } from "lucide-react"
import type { Stack, Card } from "../types"

interface ImportCSVDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportStack: (stack: Stack) => void
}

interface ParsedColumn {
  index: number
  header: string
  sampleValues: string[]
}

function parseCSVLine(line: string, separator: string): string[] {
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

export default function ImportCSVDialog({ open, onOpenChange, onImportStack }: ImportCSVDialogProps) {
  const [stackName, setStackName] = useState("")
  const [csvContent, setCsvContent] = useState("")
  const [error, setError] = useState("")
  const [step, setStep] = useState<"upload" | "configure">("upload")
  const [columns, setColumns] = useState<ParsedColumn[]>([])
  const [frontColumns, setFrontColumns] = useState<number[]>([])
  const [backColumns, setBackColumns] = useState<number[]>([])
  const [separator, setSeparator] = useState<"," | ";" | "\t">(",")
  const [previewCards, setPreviewCards] = useState<Card[]>([])
  const [hasHeaders, setHasHeaders] = useState(true)

  const detectSeparator = (content: string): "," | ";" | "\t" => {
    const firstLine = content.split("\n")[0]
    const commas = (firstLine.match(/,/g) || []).length
    const semicolons = (firstLine.match(/;/g) || []).length
    const tabs = (firstLine.match(/\t/g) || []).length

    if (tabs > commas && tabs > semicolons) return "\t"
    if (semicolons > commas) return ";"
    return ","
  }

  const analyzeCSV = (content: string) => {
    try {
      const detectedSeparator = detectSeparator(content)
      setSeparator(detectedSeparator)

      const lines = content.trim().split("\n")
      if (lines.length === 0) {
        setError("Empty file")
        return
      }

      const firstLine = parseCSVLine(lines[0], detectedSeparator)
      const dataLines = lines.slice(hasHeaders ? 1 : 0, Math.min(6, lines.length))
      const parsedDataLines = dataLines.map((line) => parseCSVLine(line, detectedSeparator))

      const detectedColumns: ParsedColumn[] = []

      for (let i = 0; i < firstLine.length; i++) {
        const header = hasHeaders ? firstLine[i] || `Column ${i + 1}` : `Column ${i + 1}`
        const sampleValues = parsedDataLines.map((line) => line[i] || "").filter((val) => val.length > 0)

        detectedColumns.push({
          index: i,
          header,
          sampleValues: sampleValues.slice(0, 3),
        })
      }

      setColumns(detectedColumns)
      setError("")
      setStep("configure")

      if (detectedColumns.length >= 2) {
        setFrontColumns([0])
        setBackColumns([1])
        generatePreview(content, detectedSeparator, [0], [1])
      }
    } catch (err) {
      setError("Error analyzing file structure")
    }
  }

  const generatePreview = (content: string, sep: string, frontCols: number[], backCols: number[]) => {
    if (frontCols.length === 0 || backCols.length === 0) {
      setPreviewCards([])
      return
    }

    try {
      const lines = content.trim().split("\n")
      const dataLines = lines.slice(hasHeaders ? 1 : 0)
      const cards: Card[] = []

      dataLines.forEach((line, index) => {
        const parts = parseCSVLine(line, sep)
        const frontText = frontCols
          .map((i) => parts[i] || "")
          .filter(Boolean)
          .join("\n")
        const backText = backCols
          .map((i) => parts[i] || "")
          .filter(Boolean)
          .join("\n")

        if (frontText && backText) {
          cards.push({
            id: `preview-${index}`,
            front: frontText,
            back: backText,
          })
        }
      })

      setPreviewCards(cards.slice(0, 3))
    } catch (err) {
      setPreviewCards([])
    }
  }

  const parseCSVWithConfig = (content: string): Card[] => {
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
          id: `${Date.now()}-${index}-${Math.random()}`,
          front: frontText,
          back: backText,
        })
      }
    })

    return cards
  }

  const addToFront = (columnIndex: number) => {
    if (!frontColumns.includes(columnIndex)) {
      const newFrontColumns = [...frontColumns, columnIndex]
      setFrontColumns(newFrontColumns)
      generatePreview(csvContent, separator, newFrontColumns, backColumns)
    }
  }

  const addToBack = (columnIndex: number) => {
    if (!backColumns.includes(columnIndex)) {
      const newBackColumns = [...backColumns, columnIndex]
      setBackColumns(newBackColumns)
      generatePreview(csvContent, separator, frontColumns, newBackColumns)
    }
  }

  const removeFromFront = (columnIndex: number) => {
    const newFrontColumns = frontColumns.filter((i) => i !== columnIndex)
    setFrontColumns(newFrontColumns)
    generatePreview(csvContent, separator, newFrontColumns, backColumns)
  }

  const removeFromBack = (columnIndex: number) => {
    const newBackColumns = backColumns.filter((i) => i !== columnIndex)
    setBackColumns(newBackColumns)
    generatePreview(csvContent, separator, frontColumns, newBackColumns)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setCsvContent(content)
        if (!stackName) {
          setStackName(file.name.replace(/\.(csv|txt)$/, ""))
        }
        analyzeCSV(content)
      }
      reader.readAsText(file)
    }
  }

  const handleContentChange = (content: string) => {
    setCsvContent(content)
    if (content.trim()) {
      analyzeCSV(content)
    } else {
      setStep("upload")
      setColumns([])
    }
  }

  // ... rest of the component continues unchanged (UI rendering, handlers, etc.)

  const handleImport = () => {
    setError("")

    if (!stackName.trim()) {
      setError("Please enter a stack name")
      return
    }

    if (frontColumns.length === 0) {
      setError("Please select at least one column for the front of the card")
      return
    }

    if (backColumns.length === 0) {
      setError("Please select at least one column for the back of the card")
      return
    }

    try {
      const cards = parseCSVWithConfig(csvContent)

      if (cards.length === 0) {
        setError("No valid cards found with the selected configuration")
        return
      }

      const newStack: Stack = {
        id: Date.now().toString(),
        name: stackName.trim(),
        cards,
        todayStats: { wordsStudied: 0, timeSpent: 0, accuracy: 0 },
      }

      onImportStack(newStack)
      resetDialog()
      onOpenChange(false)
    } catch (err) {
      setError("Error creating stack. Please check your configuration.")
    }
  }

  const resetDialog = () => {
    setStackName("")
    setCsvContent("")
    setStep("upload")
    setColumns([])
    setFrontColumns([])
    setBackColumns([])
    setPreviewCards([])
    setError("")
  }

  const handleBack = () => {
    setStep("upload")
    setColumns([])
    setFrontColumns([])
    setBackColumns([])
    setPreviewCards([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Cards from File {step === "configure" && "- Configure Columns"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {step === "upload" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="stackName">Stack Name</Label>
                <Input
                  id="stackName"
                  value={stackName}
                  onChange={(e) => setStackName(e.target.value)}
                  placeholder="e.g., French Vocabulary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="csvFile">Upload File</Label>
                <Input id="csvFile" type="file" accept=".csv,.txt" onChange={handleFileUpload} />
              </div>

              <div className="text-center text-muted-foreground">or</div>

              <div className="space-y-2">
                <Label htmlFor="csvContent">Paste Content</Label>
                <Textarea
                  id="csvContent"
                  value={csvContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Paste your CSV, TSV, Anki export, or any delimited content here..."
                  rows={8}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                <strong>Supported formats:</strong> CSV, TSV, Anki exports, or any delimited text file
              </div>
            </>
          )}

          {step === "configure" && (
            <>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Detected {columns.length} columns using "{separator === "\t" ? "tab" : separator}" separator
                  </div>
                  <Select value={hasHeaders.toString()} onValueChange={(value) => setHasHeaders(value === "true")}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">First row is headers</SelectItem>
                      <SelectItem value="false">No headers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* CSV Table View */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 p-3 border-b">
                    <h3 className="font-semibold">Your Data Preview</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          {columns.map((column) => (
                            <th key={column.index} className="p-3 text-left border-r last:border-r-0 min-w-32">
                              <div className="font-semibold">{column.header}</div>
                              <div className="flex gap-1 mt-2">
                                <Button
                                  size="sm"
                                  variant={frontColumns.includes(column.index) ? "default" : "outline"}
                                  onClick={() =>
                                    frontColumns.includes(column.index)
                                      ? removeFromFront(column.index)
                                      : addToFront(column.index)
                                  }
                                  className="text-xs h-6"
                                >
                                  {frontColumns.includes(column.index) ? "✓ Front" : "+ Front"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={backColumns.includes(column.index) ? "default" : "outline"}
                                  onClick={() =>
                                    backColumns.includes(column.index)
                                      ? removeFromBack(column.index)
                                      : addToBack(column.index)
                                  }
                                  className="text-xs h-6"
                                >
                                  {backColumns.includes(column.index) ? "✓ Back" : "+ Back"}
                                </Button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {columns[0]?.sampleValues.map((_, rowIndex) => (
                          <tr key={rowIndex} className="border-b">
                            {columns.map((column) => (
                              <td key={column.index} className="p-3 border-r last:border-r-0">
                                {column.sampleValues[rowIndex] || ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Selected Columns Summary */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold">Front of Card:</Label>
                    <div className="border rounded p-3 min-h-16 bg-blue-50">
                      {frontColumns.length === 0 ? (
                        <span className="text-muted-foreground text-sm">Select columns above</span>
                      ) : (
                        frontColumns.map((colIndex) => (
                          <div key={colIndex} className="text-sm">
                            {columns[colIndex]?.header}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Back of Card:</Label>
                    <div className="border rounded p-3 min-h-16 bg-green-50">
                      {backColumns.length === 0 ? (
                        <span className="text-muted-foreground text-sm">Select columns above</span>
                      ) : (
                        backColumns.map((colIndex) => (
                          <div key={colIndex} className="text-sm">
                            {columns[colIndex]?.header}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview Cards */}
                {previewCards.length > 0 && (
                  <div className="space-y-3">
                    <Label className="font-semibold">
                      Card Preview ({previewCards.length} of {parseCSVWithConfig(csvContent).length} cards)
                    </Label>
                    <div className="space-y-3">
                      {previewCards.map((card, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-white">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">FRONT</div>
                              <div className="whitespace-pre-line font-medium">{card.front}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">BACK</div>
                              <div className="whitespace-pre-line">{card.back}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <div>
            {step === "configure" && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step === "configure" && (
              <Button onClick={handleImport} disabled={frontColumns.length === 0 || backColumns.length === 0}>
                <Upload className="w-4 h-4 mr-2" />
                Import {parseCSVWithConfig(csvContent).length} Cards
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
