import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import AppPressable from "./AppPressable"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as DocumentPicker from "expo-document-picker"
import { readAsStringAsync } from "expo-file-system/legacy"
import type { Card, Stack } from "../types"
import { colors } from "../theme/colors"
import {
  analyzeCsvContent,
  parseCardsFromCsv,
  separatorLabel,
  type CsvSeparator,
  type ParsedColumn,
} from "../lib/csv-import"

type ImportMode = "new-stack" | "into-stack"

interface ImportCsvModalProps {
  visible: boolean
  mode: ImportMode
  onClose: () => void
  onImportNewStack?: (stack: Stack) => void
  onImportCards?: (cards: Card[]) => void
}

export default function ImportCsvModal({
  visible,
  mode,
  onClose,
  onImportNewStack,
  onImportCards,
}: ImportCsvModalProps) {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<"upload" | "configure">("upload")
  const [stackName, setStackName] = useState("")
  const [csvContent, setCsvContent] = useState("")
  const [error, setError] = useState("")
  const [loadingFile, setLoadingFile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [columns, setColumns] = useState<ParsedColumn[]>([])
  const [separator, setSeparator] = useState<CsvSeparator>(",")
  const [frontColumns, setFrontColumns] = useState<number[]>([])
  const [backColumns, setBackColumns] = useState<number[]>([])
  const [hasHeaders, setHasHeaders] = useState(true)

  useEffect(() => {
    if (visible) reset()
  }, [visible])

  const reset = () => {
    setStep("upload")
    setStackName("")
    setCsvContent("")
    setError("")
    setLoadingFile(false)
    setColumns([])
    setSeparator(",")
    setFrontColumns([])
    setBackColumns([])
    setHasHeaders(true)
  }

  const analyzeContent = (content: string, headers = hasHeaders) => {
    const trimmed = content.trim()
    if (!trimmed) {
      setStep("upload")
      setColumns([])
      return
    }

    const { separator: sep, columns: cols } = analyzeCsvContent(trimmed, headers)
    if (cols.length === 0) {
      setError("Could not read any columns from this file.")
      return
    }

    setCsvContent(trimmed)
    setSeparator(sep)
    setColumns(cols)
    setError("")
    setStep("configure")

    if (cols.length >= 2) {
      setFrontColumns([0])
      setBackColumns([1])
    } else {
      setFrontColumns([])
      setBackColumns([])
    }
  }

  const pickFile = async () => {
    setError("")
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "text/plain", "text/*", "*/*"],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      setLoadingFile(true)
      const content = await readAsStringAsync(asset.uri)
      if (mode === "new-stack" && !stackName.trim()) {
        setStackName(asset.name.replace(/\.(csv|txt|tsv)$/i, ""))
      }
      analyzeContent(content)
    } catch {
      setError("Could not read that file. Try pasting the content instead.")
    } finally {
      setLoadingFile(false)
    }
  }

  const toggleColumn = (columnIndex: number, side: "front" | "back") => {
    if (side === "front") {
      setFrontColumns((prev) =>
        prev.includes(columnIndex) ? prev.filter((i) => i !== columnIndex) : [...prev, columnIndex],
      )
      setBackColumns((prev) => prev.filter((i) => i !== columnIndex))
    } else {
      setBackColumns((prev) =>
        prev.includes(columnIndex) ? prev.filter((i) => i !== columnIndex) : [...prev, columnIndex],
      )
      setFrontColumns((prev) => prev.filter((i) => i !== columnIndex))
    }
  }

  const parsedCards = useMemo(() => {
    if (frontColumns.length === 0 || backColumns.length === 0 || !csvContent) return []
    return parseCardsFromCsv(csvContent, separator, hasHeaders, frontColumns, backColumns)
  }, [csvContent, separator, hasHeaders, frontColumns, backColumns])

  const previewCards = parsedCards.slice(0, 3)

  const handleImport = () => {
    if (importing) return
    setError("")

    if (mode === "new-stack" && !stackName.trim()) {
      setError("Please enter a stack name.")
      return
    }
    if (frontColumns.length === 0 || backColumns.length === 0) {
      setError("Pick one column for the front and one for the back.")
      return
    }
    if (parsedCards.length === 0) {
      setError("No valid cards found with this setup.")
      return
    }

    setImporting(true)
    try {
      if (mode === "new-stack") {
        onImportNewStack?.({
          id: Date.now().toString(),
          name: stackName.trim(),
          cards: parsedCards,
          todayStats: { wordsStudied: 0, timeSpent: 0, accuracy: 0 },
          allTimeStats: { wordsStudied: 0, timeSpent: 0, sessionsCount: 0 },
        })
      } else {
        onImportCards?.(parsedCards)
      }
      onClose()
    } finally {
      setImporting(false)
    }
  }

  const title =
    mode === "new-stack"
      ? step === "upload"
        ? "Import CSV as new stack"
        : "Configure columns"
      : step === "upload"
        ? "Import cards from CSV"
        : "Configure columns"

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <AppPressable onPress={step === "configure" ? () => setStep("upload") : onClose}>
            <Text style={styles.headerAction}>{step === "configure" ? "← Back" : "Cancel"}</Text>
          </AppPressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {step === "upload" && (
            <>
              {mode === "new-stack" && (
                <>
                  <Text style={styles.label}>Stack name</Text>
                  <TextInput
                    style={styles.input}
                    value={stackName}
                    onChangeText={setStackName}
                    placeholder="e.g. French Vocabulary"
                  />
                </>
              )}

              <AppPressable style={styles.fileBtn} onPress={pickFile} disabled={loadingFile}>
                {loadingFile ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.fileBtnText}>Choose CSV file</Text>
                )}
              </AppPressable>

              <Text style={styles.orText}>or paste content</Text>

              <TextInput
                style={styles.textArea}
                value={csvContent}
                onChangeText={(text) => {
                  setCsvContent(text)
                  if (text.trim()) analyzeContent(text)
                  else {
                    setStep("upload")
                    setColumns([])
                  }
                }}
                placeholder="Paste CSV, TSV, or Anki export here…"
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.hint}>
                Supports comma, tab, or semicolon-separated files. You can map columns on the next step.
              </Text>
            </>
          )}

          {step === "configure" && (
            <>
              <Text style={styles.meta}>
                {columns.length} columns · {separatorLabel(separator)} separator · {parsedCards.length} cards
              </Text>

              <AppPressable style={styles.toggleRow} onPress={() => analyzeContent(csvContent, !hasHeaders)}>
                <View style={[styles.checkbox, hasHeaders && styles.checkboxOn]} />
                <Text style={styles.toggleLabel}>First row is headers</Text>
              </AppPressable>

              <Text style={styles.sectionTitle}>Tap a column for front or back</Text>
              {columns.map((column) => {
                const isFront = frontColumns.includes(column.index)
                const isBack = backColumns.includes(column.index)
                return (
                  <View key={column.index} style={styles.columnCard}>
                    <Text style={styles.columnTitle}>{column.header}</Text>
                    {column.sampleValues.length > 0 && (
                      <Text style={styles.columnSample} numberOfLines={2}>
                        e.g. {column.sampleValues.join(" · ")}
                      </Text>
                    )}
                    <View style={styles.columnActions}>
                      <AppPressable
                        style={[styles.sideBtn, isFront && styles.sideBtnActive]}
                        onPress={() => toggleColumn(column.index, "front")}
                      >
                        <Text style={isFront ? styles.sideBtnTextActive : styles.sideBtnText}>
                          {isFront ? "✓ Front" : "Front"}
                        </Text>
                      </AppPressable>
                      <AppPressable
                        style={[styles.sideBtn, isBack && styles.sideBtnActive]}
                        onPress={() => toggleColumn(column.index, "back")}
                      >
                        <Text style={isBack ? styles.sideBtnTextActive : styles.sideBtnText}>
                          {isBack ? "✓ Back" : "Back"}
                        </Text>
                      </AppPressable>
                    </View>
                  </View>
                )
              })}

              {previewCards.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Preview</Text>
                  {previewCards.map((card, index) => (
                    <View key={index} style={styles.previewCard}>
                      <Text style={styles.previewLabel}>Front</Text>
                      <Text style={styles.previewFront}>{card.front}</Text>
                      <Text style={[styles.previewLabel, { marginTop: 8 }]}>Back</Text>
                      <Text style={styles.previewBack}>{card.back}</Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        {step === "configure" && (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <AppPressable
              style={[styles.importBtn, (parsedCards.length === 0 || importing) && styles.disabled]}
              onPress={handleImport}
              disabled={parsedCards.length === 0 || importing}
            >
              <Text style={styles.importBtnText}>
                {importing
                  ? "Importing…"
                  : `Import ${parsedCards.length} card${parsedCards.length !== 1 ? "s" : ""}`}
              </Text>
            </AppPressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.card,
  },
  headerAction: { fontSize: 16, color: colors.brand.teal, minWidth: 64 },
  headerTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center", color: colors.foreground },
  headerSpacer: { minWidth: 64 },
  body: { padding: 16, gap: 12 },
  label: { fontSize: 14, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.foreground,
  },
  fileBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  fileBtnText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 16 },
  orText: { textAlign: "center", color: colors.muted, marginVertical: 4 },
  textArea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: colors.card,
    color: colors.foreground,
  },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  meta: { fontSize: 14, color: colors.mutedLight },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 4,
    backgroundColor: colors.card,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleLabel: { fontSize: 14, color: colors.foreground },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 4, color: colors.foreground },
  columnCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  columnTitle: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  columnSample: { fontSize: 13, color: colors.muted, marginTop: 4 },
  columnActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  sideBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  sideBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sideBtnText: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  sideBtnTextActive: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  previewLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  previewFront: { fontSize: 15, fontWeight: "600", marginTop: 2, color: colors.foreground },
  previewBack: { fontSize: 15, color: colors.mutedLight, marginTop: 2 },
  error: { color: colors.destructive, fontSize: 14, backgroundColor: colors.destructiveBg, padding: 10, borderRadius: 8 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.card,
  },
  importBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  importBtnText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 16 },
  disabled: { opacity: 0.4 },
})
