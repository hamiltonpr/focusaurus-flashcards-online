import { useEffect, useMemo, useRef } from "react"
import { PanResponder, ScrollView, StyleSheet, Text, View } from "react-native"
import AppPressable from "./AppPressable"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import type { Card, Stack, TestMode } from "../types"
import { useTestSession } from "../hooks/use-test-session"
import { getTodayString } from "../lib/spaced-repetition"
import { colors } from "../theme/colors"
import FlashCard from "./FlashCard"

export interface KnowledgeCheckProgressUpdate {
  seenCardIds: string[]
  cards: Card[]
}

interface TestSessionProps {
  stack: Stack
  mode: TestMode
  onComplete: (updatedStack: Stack) => void
  onExit: (progress?: KnowledgeCheckProgressUpdate) => void
}

export default function TestSession({ stack, mode, onComplete, onExit }: TestSessionProps) {
  const insets = useSafeAreaInsets()
  const seenCardIds = stack.knowledgeCheckProgress?.seenCardIds
  const {
    state,
    cards,
    currentCard,
    flip,
    unflip,
    markRemembered,
    markForgot,
    goToPrevious,
    canGoBack,
    progress,
    getSessionStats,
    getAllSeenCardIds,
  } = useTestSession(stack.cards, { mode, seenCardIds })

  const isCheck = mode === "check"

  const goBackRef = useRef(goToPrevious)
  goBackRef.current = goToPrevious
  const canGoBackRef = useRef(canGoBack)
  canGoBackRef.current = canGoBack

  const swipeBackResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 12,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 60 && canGoBackRef.current) {
          goBackRef.current()
        }
      },
    }),
  ).current

  useEffect(() => {
    if (!state.isComplete) return
    const stats = getSessionStats()
    onComplete({
      ...stack,
      cards,
      knowledgeCheckProgress: undefined,
      lastTestSession: {
        accuracy: stats.accuracy,
        durationMinutes: stats.durationMinutes,
        avgSecondsPerCard: stats.avgSecondsPerCard,
        cardsTotal: stats.cardsTotal,
        completedAt: getTodayString(),
        testMode: stats.testMode,
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isComplete])

  const remaining = state.queue.length
  const knownWords = useMemo(
    () => cards.filter((c) => c.cardType === 2).map((c) => c.front),
    [cards],
  )
  const checkedTotal = state.initialSeenCount + state.cardsCompleted

  const handleExit = () => {
    if (isCheck && state.sessionAnswers.length > 0) {
      onExit({ seenCardIds: getAllSeenCardIds(), cards })
    } else {
      onExit()
    }
  }

  if (state.isComplete) return null

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <AppPressable onPress={handleExit} style={styles.exitBtn}>
          <Text style={styles.exitText}>← Exit</Text>
        </AppPressable>
        <Text style={styles.title}>{stack.name}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}>
        <Text style={styles.phaseLabel}>
          {isCheck
            ? `${checkedTotal} of ${state.totalCards} checked · ${remaining} left`
            : `${remaining} card${remaining !== 1 ? "s" : ""} left · ${state.cardsCompleted} cleared`}
        </Text>
        {canGoBack ? (
          <Text style={styles.swipeHint}>Swipe right on the card to go back and reanswer</Text>
        ) : null}

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        {currentCard ? (
          <View {...swipeBackResponder.panHandlers}>
            <FlashCard
              sessionCard={currentCard}
              isFlipped={state.isFlipped}
              onFlip={flip}
              onUnflip={unflip}
              onKnown={markRemembered}
              onUnknown={markForgot}
              knownWords={knownWords}
              knownLabel={isCheck ? "Know it" : "Remembered"}
              unknownLabel={isCheck ? "Don't know" : "Forgot"}
            />
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {isCheck && state.totalCards === 0
                ? "Every card in this stack is already learned."
                : isCheck && state.initialSeenCount >= state.totalCards
                  ? "You've checked every unlearned card."
                  : "No cards in this stack."}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  exitBtn: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  exitText: {
    fontSize: 16,
    color: colors.brand.teal,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    color: colors.foreground,
  },
  content: {
    paddingTop: 8,
  },
  phaseLabel: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 13,
    marginBottom: 12,
  },
  swipeHint: {
    textAlign: "center",
    color: colors.mutedLight,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  emptyCard: {
    margin: 16,
    padding: 32,
    backgroundColor: colors.card,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyText: {
    color: colors.muted,
  },
})
