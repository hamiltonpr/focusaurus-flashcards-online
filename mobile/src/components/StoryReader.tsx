import { useMemo, useState } from "react"
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native"
import AppPressable from "./AppPressable"
import type { Card, Stack } from "../types"
import { colors } from "../theme/colors"
import { generateCardId } from "../lib/card-utils"
import { lookupDictionary } from "../lib/reading/dictionary"
import { preferSurfaceReading } from "../lib/reading/reading-utils"
import type { StoryToken } from "../lib/reading/types"

interface StoryReaderProps {
  title: string
  tokens: StoryToken[]
  stack: Stack
  attribution?: string
  onAddCard: (card: Card) => void
  onBumpCard: (cardId: string) => void
}

interface SelectedWord {
  token: StoryToken
  existingCard: Card | null
  definition?: string
  reading?: string
  lookupError?: string
  loading: boolean
}

export default function StoryReader({
  title,
  tokens,
  stack,
  attribution,
  onAddCard,
  onBumpCard,
}: StoryReaderProps) {
  const [selected, setSelected] = useState<SelectedWord | null>(null)
  const [addedTexts, setAddedTexts] = useState<Set<string>>(new Set())
  const [bumpedIds, setBumpedIds] = useState<Set<string>>(new Set())
  const [lookupCache, setLookupCache] = useState<Map<string, { reading?: string; definition: string }>>(
    new Map(),
  )

  const findExistingCard = (text: string): Card | null => {
    const lower = text.toLowerCase()
    return (
      stack.cards.find((c) => {
        const frontFirst = c.front.split("\n")[0].toLowerCase()
        const backFirst = c.back.split("\n")[0].toLowerCase()
        return frontFirst === lower || backFirst === lower
      }) ?? null
    )
  }

  const handleTokenPress = async (token: StoryToken) => {
    if (!token.isWord) return

    const existingCard = findExistingCard(token.text)
    const cached = lookupCache.get(token.text)

    setSelected({
      token,
      existingCard,
      definition: cached?.definition ?? token.definition,
      reading: preferSurfaceReading(token.text, token.reading, cached?.reading),
      loading: !cached && !token.definition,
    })

    if (cached || token.definition) return

    try {
      const result = await lookupDictionary(token.text, stack.cards)
      if (result) {
        const reading = preferSurfaceReading(token.text, token.reading, result.reading)
        setLookupCache((prev) => {
          const next = new Map(prev)
          next.set(token.text, { reading, definition: result.definition })
          return next
        })
        setSelected((prev) =>
          prev?.token.text === token.text
            ? {
                ...prev,
                definition: result.definition,
                reading,
                loading: false,
              }
            : prev,
        )
      } else {
        setSelected((prev) =>
          prev?.token.text === token.text
            ? { ...prev, loading: false, lookupError: "No definition found. Check your connection." }
            : prev,
        )
      }
    } catch {
      setSelected((prev) =>
        prev?.token.text === token.text
          ? { ...prev, loading: false, lookupError: "Lookup failed. Check your internet connection." }
          : prev,
      )
    }
  }

  const handleAddCard = () => {
    if (!selected) return
    const back = selected.definition ?? selected.token.definition ?? ""
    onAddCard({
      id: generateCardId(),
      front: selected.token.text,
      back,
      cardType: 1,
      interval: 0,
    })
    setAddedTexts((prev) => new Set(prev).add(selected.token.text))
    setSelected(null)
  }

  const handleBump = () => {
    if (!selected?.existingCard) return
    onBumpCard(selected.existingCard.id)
    setBumpedIds((prev) => new Set(prev).add(selected.existingCard!.id))
    setSelected(null)
  }

  const renderedTokens = useMemo(
    () =>
      tokens.map((token, idx) => {
        if (!token.isWord) {
          return (
            <Text key={`${idx}-${token.text}`} style={styles.bodyText}>
              {token.text}
            </Text>
          )
        }

        const existing = findExistingCard(token.text)
        const wasAdded = addedTexts.has(token.text)
        const known = !!existing

        return (
          <Text
            key={`${idx}-${token.text}`}
            style={[
              styles.bodyText,
              styles.wordBase,
              known || wasAdded ? styles.wordKnown : styles.wordTappable,
            ]}
            onPress={() => handleTokenPress(token)}
          >
            {token.text}
          </Text>
        )
      }),
    [tokens, stack.cards, addedTexts, lookupCache],
  )

  const displayDefinition = selected?.definition ?? selected?.token.definition
  const displayReading = preferSurfaceReading(
    selected?.token.text ?? "",
    selected?.token.reading,
    selected?.reading,
  )
  const showKanjiBreakdown =
    selected?.token.kanjiText &&
    selected?.token.kanjiReading &&
    selected.token.kanjiText !== selected.token.text
  const kanjiPartsLine = selected?.token.kanjiParts?.length
    ? selected.token.kanjiParts.map((p) => `${p.text} · ${p.reading}`).join("　")
    : showKanjiBreakdown
      ? `${selected!.token.kanjiText} · ${selected!.token.kanjiReading}`
      : null

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.legend}>
        <Text style={styles.legendItem}>
          <Text style={styles.wordKnown}>word</Text> = in your stack
        </Text>
        <Text style={styles.legendItem}>
          <Text style={styles.wordTappable}>word</Text> = tap to look up (Jisho)
        </Text>
      </View>

      <Text style={styles.storyLine}>{renderedTokens}</Text>

      {attribution ? <Text style={styles.attribution}>{attribution}</Text> : null}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <AppPressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelected(null)}
            feedback={false}
          />
          <View style={styles.sheet}>
            {selected ? (
              <>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetWordBlock}>
                    <Text style={styles.sheetWord}>{selected.token.text}</Text>
                    {displayReading && displayReading !== selected.token.text ? (
                      <Text style={styles.sheetReading}>{displayReading}</Text>
                    ) : null}
                    {kanjiPartsLine ? (
                      <Text style={styles.sheetKanjiReading}>{kanjiPartsLine}</Text>
                    ) : null}
                    {selected.loading ? (
                      <View style={styles.lookupLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.sheetDefinition}>Looking up…</Text>
                      </View>
                    ) : displayDefinition ? (
                      <Text style={styles.sheetDefinition}>{displayDefinition}</Text>
                    ) : (
                      <Text style={styles.sheetDefinition}>
                        {selected.lookupError ?? "No definition found."}
                      </Text>
                    )}
                  </View>
                  <AppPressable onPress={() => setSelected(null)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </AppPressable>
                </View>

                {selected.existingCard ? (
                  <View style={styles.sheetActions}>
                    <Text style={styles.inStackLabel}>
                      Already in stack: {selected.existingCard.front} → {selected.existingCard.back}
                    </Text>
                    {bumpedIds.has(selected.existingCard.id) ? (
                      <Text style={styles.successText}>Scheduled for priority review tomorrow!</Text>
                    ) : (
                      <AppPressable style={styles.primaryBtn} onPress={handleBump}>
                        <Text style={styles.primaryBtnText}>Study this ASAP — bump to tomorrow</Text>
                      </AppPressable>
                    )}
                  </View>
                ) : addedTexts.has(selected.token.text) ? (
                  <Text style={styles.successText}>Added to stack as a new card!</Text>
                ) : (
                  <AppPressable
                    style={[styles.primaryBtn, selected.loading && styles.btnDisabled]}
                    onPress={handleAddCard}
                    disabled={selected.loading}
                  >
                    <Text style={styles.primaryBtnText}>
                      {displayDefinition ? "Add to stack as flashcard" : "Add to stack anyway"}
                    </Text>
                  </AppPressable>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: colors.foreground, textAlign: "center" },
  legend: { gap: 4 },
  legendItem: { fontSize: 12, color: colors.muted },
  storyLine: {
    fontSize: 19,
    lineHeight: 36,
    color: colors.foreground,
    marginBottom: 24,
  },
  bodyText: { fontSize: 19, lineHeight: 36, color: colors.foreground },
  wordBase: { fontSize: 19, lineHeight: 36 },
  wordKnown: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  wordTappable: {
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
    borderStyle: "dotted",
  },
  attribution: { fontSize: 11, color: colors.muted, lineHeight: 16, marginTop: 8 },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
    gap: 14,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  sheetWordBlock: { flex: 1, gap: 4, paddingRight: 12 },
  sheetWord: { fontSize: 30, fontWeight: "700", color: colors.foreground },
  sheetReading: { fontSize: 18, color: colors.muted },
  sheetKanjiReading: { fontSize: 15, color: colors.muted, opacity: 0.85 },
  sheetDefinition: { fontSize: 16, color: colors.muted, marginTop: 4 },
  lookupLoading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  closeBtn: { fontSize: 20, color: colors.muted, padding: 4 },
  sheetActions: { gap: 10 },
  inStackLabel: { fontSize: 14, color: colors.foreground },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 14,
  },
  primaryBtnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  successText: { color: colors.brand.teal, fontSize: 14 },
})
