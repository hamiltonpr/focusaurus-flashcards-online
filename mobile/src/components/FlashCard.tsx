import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import AppPressable from "./AppPressable"
import type { SessionCard } from "../hooks/use-study-session"
import { colors, radius } from "../theme/colors"

interface FlashCardProps {
  sessionCard: SessionCard
  isFlipped: boolean
  onFlip: () => void
  onUnflip: () => void
  onKnown: () => void
  onUnknown: () => void
  knownWords: string[]
  knownLabel?: string
  unknownLabel?: string
  expanded?: boolean
}

export default function FlashCard({
  sessionCard,
  isFlipped,
  onFlip,
  onUnflip,
  onKnown,
  onUnknown,
  knownWords,
  knownLabel = "Knew It",
  unknownLabel = "Didn't Know",
  expanded = false,
}: FlashCardProps) {
  const { height: windowHeight } = useWindowDimensions()
  const { card, sessionType } = sessionCard
  const cardMinHeight = expanded ? Math.max(300, windowHeight * 0.38) : 220
  const frontText = sessionType === 1 ? card.front : card.back
  const backText = sessionType === 1 ? card.back : card.front
  const frontLabel = sessionType === 1 ? "Foreign" : "English"
  const backLabel = sessionType === 1 ? "English" : "Foreign"
  const [sentence, setSentence] = useState<string | null>(null)
  const [loadingSentence, setLoadingSentence] = useState(false)
  const [sentenceError, setSentenceError] = useState<string | null>(null)
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()

  useEffect(() => {
    setSentence(null)
    setSentenceError(null)
  }, [card.id])

  const generateSentence = async () => {
    if (!apiBase) {
      setSentenceError("Set EXPO_PUBLIC_API_BASE_URL for sentence generation.")
      return
    }
    setLoadingSentence(true)
    setSentenceError(null)
    setSentence(null)
    try {
      const res = await fetch(`${apiBase}/api/generate-sentence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: card.front,
          translation: card.back,
          language: "the target language",
          knownWords,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Failed to generate sentence")
      setSentence(data.sentence ?? "")
    } catch (e: unknown) {
      setSentenceError(e instanceof Error ? e.message : "Failed to generate sentence")
    } finally {
      setLoadingSentence(false)
    }
  }

  const renderLines = (text: string, primary: boolean) =>
    text.split("\n").map((line, i) => (
      <Text
        key={i}
        style={[
          primary && i === 0
            ? expanded
              ? styles.cardTextPrimaryExpanded
              : styles.cardTextPrimary
            : styles.cardTextSecondary,
          !primary && i > 0 && styles.cardLineDivider,
        ]}
      >
        {line}
      </Text>
    ))

  return (
    <View style={[styles.container, expanded && styles.containerExpanded]}>
      <AppPressable
        style={[styles.card, { minHeight: cardMinHeight }, expanded && styles.cardExpanded]}
        onPress={isFlipped ? onUnflip : onFlip}
      >
        <Text style={styles.label}>{isFlipped ? backLabel : frontLabel}</Text>
        <View style={styles.textBlock}>
          {renderLines(isFlipped ? backText : frontText, true)}
        </View>
        <Text style={styles.hint}>{isFlipped ? "Tap to flip back" : "Tap to reveal"}</Text>
      </AppPressable>

      <View style={styles.sentenceArea}>
        {!sentence && !loadingSentence && (
          <AppPressable style={styles.sentenceBtn} onPress={generateSentence}>
            <Text style={styles.sentenceBtnText}>See it in a sentence</Text>
          </AppPressable>
        )}
        {loadingSentence && (
          <View style={styles.sentenceLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.sentenceLoadingText}>Generating sentence…</Text>
          </View>
        )}
        {sentenceError ? <Text style={styles.sentenceError}>{sentenceError}</Text> : null}
        {sentence ? <Text style={styles.sentenceText}>{sentence}</Text> : null}
      </View>

      {isFlipped ? (
        <View style={styles.actions}>
          <AppPressable
            style={[styles.actionBtn, styles.unknownBtn]}
            onPress={onUnknown}
           
          >
            <Text style={styles.unknownText}>{unknownLabel}</Text>
          </AppPressable>
          <AppPressable style={[styles.actionBtn, styles.knownBtn]} onPress={onKnown}>
            <Text style={styles.knownText}>{knownLabel}</Text>
          </AppPressable>
        </View>
      ) : (
        <AppPressable style={styles.flipBtn} onPress={onFlip}>
          <Text style={styles.flipBtnText}>Flip Card</Text>
        </AppPressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 20,
    paddingHorizontal: 16,
  },
  containerExpanded: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 0,
    gap: 16,
  },
  card: {
    minHeight: 220,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brand.black,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardExpanded: {
    flex: 1,
    paddingVertical: 32,
    paddingHorizontal: 28,
  },
  label: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  textBlock: {
    alignItems: "center",
    gap: 8,
  },
  cardTextPrimary: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    color: colors.foreground,
  },
  cardTextPrimaryExpanded: {
    fontSize: 34,
    fontWeight: "700",
    textAlign: "center",
    color: colors.foreground,
    lineHeight: 42,
  },
  cardTextSecondary: {
    fontSize: 18,
    color: colors.muted,
    textAlign: "center",
  },
  cardLineDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
    marginTop: 4,
  },
  hint: {
    marginTop: 20,
    fontSize: 13,
    color: colors.mutedLight,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  sentenceArea: {
    minHeight: 40,
    alignItems: "center",
    gap: 8,
  },
  sentenceBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sentenceBtnText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  sentenceLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
  sentenceLoadingText: { color: colors.muted, fontSize: 13 },
  sentenceError: { color: colors.destructive, fontSize: 12, textAlign: "center" },
  sentenceText: {
    color: colors.foreground,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  unknownBtn: {
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.card,
  },
  unknownText: {
    color: colors.destructive,
    fontWeight: "600",
    fontSize: 16,
  },
  knownBtn: {
    backgroundColor: colors.primary,
  },
  knownText: {
    color: colors.primaryForeground,
    fontWeight: "600",
    fontSize: 16,
  },
  flipBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  flipBtnText: {
    color: colors.primaryForeground,
    fontWeight: "600",
    fontSize: 16,
  },
})
