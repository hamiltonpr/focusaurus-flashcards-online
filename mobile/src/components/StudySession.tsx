import { useEffect } from "react"
import { Alert, StyleSheet, Text, View } from "react-native"
import AppPressable from "./AppPressable"
import { SafeAreaView } from "react-native-safe-area-context"
import type { Stack, StudyGoal, GlobalSettings } from "../types"
import { useStudySession } from "../hooks/use-study-session"
import { getTodayString } from "../lib/spaced-repetition"
import { colors } from "../theme/colors"
import FlashCard from "./FlashCard"
import SessionHud from "./SessionHud"

interface StudySessionProps {
  stack: Stack
  goal: StudyGoal
  globalSettings: GlobalSettings
  onComplete: (updatedStack: Stack) => void
  onExit: () => void
}

export default function StudySession({
  stack,
  goal,
  globalSettings,
  onComplete,
  onExit,
}: StudySessionProps) {
  const {
    state,
    currentCard,
    flip,
    unflip,
    markKnown,
    markUnknown,
    jumpToShortTerm,
    jumpToEndOfDay,
    getUpdatedCards,
    sessionProgress,
    totalSessionCards,
    cardsExitedLoop,
  } = useStudySession(stack, goal, globalSettings)

  useEffect(() => {
    if (state.phase === "complete") {
      const updatedCards = getUpdatedCards()
      const sessionMinutes = Math.round((Date.now() - state.sessionStartTime) / 60_000)
      const wordsLearned = state.endOfDayPile.length
      const accuracy =
        state.endOfDayPile.length > 0
          ? Math.round((state.endOfDayPile.length / Math.max(totalSessionCards, 1)) * 100)
          : 0

      onComplete({
        ...stack,
        cards: updatedCards,
        lastStudied: getTodayString(),
        todayStats: {
          wordsStudied: wordsLearned,
          timeSpent: sessionMinutes,
          accuracy,
        },
        allTimeStats: {
          wordsStudied: stack.allTimeStats.wordsStudied + wordsLearned,
          timeSpent: stack.allTimeStats.timeSpent + sessionMinutes,
          sessionsCount: stack.allTimeStats.sessionsCount + 1,
        },
        lastStudySession: {
          wordsStudied: wordsLearned,
          timeSpentMinutes: sessionMinutes,
          accuracy,
          completedAt: getTodayString(),
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  const shortTermCount =
    state.phase === "short-term"
      ? state.shortTermReviewCards.length - state.shortTermReviewIndex
      : state.shortTermQueue.length

  const endOfDayCount =
    state.phase === "end-of-day"
      ? state.endOfDayPile.length - state.endOfDayIndex
      : state.endOfDayPile.length

  const handleExit = () => {
    Alert.alert(
      "Exit without saving?",
      "Your study session progress won't be saved. Tap End of Day when you're finished studying to save your progress.",
      [
        { text: "Keep Studying", style: "cancel" },
        { text: "Exit Anyway", style: "destructive", onPress: onExit },
      ],
    )
  }

  if (state.phase === "complete") return null

  const phaseLabel =
    state.phase === "loop"
      ? `Card ${state.currentLoopIndex + 1} of ${state.loopCards.length} in loop`
      : state.phase === "short-term"
        ? `Short-term review — ${state.shortTermReviewIndex + 1} of ${state.shortTermReviewCards.length}`
        : `End-of-day review — ${state.endOfDayIndex + 1} of ${state.endOfDayPile.length}`

  const canJumpShortTerm = state.shortTermQueue.length > 0 && state.phase !== "short-term"
  const canJumpEndOfDay = state.phase !== "end-of-day"

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <AppPressable onPress={handleExit} style={styles.exitBtn}>
          <Text style={styles.exitText}>← Exit</Text>
        </AppPressable>
        <Text style={styles.title} numberOfLines={1}>
          {stack.name}
        </Text>
      </View>

      <View style={styles.main}>
        <Text style={styles.phaseLabel}>{phaseLabel}</Text>

        <View style={styles.cardArea}>
          {currentCard ? (
            <FlashCard
              sessionCard={currentCard}
              isFlipped={state.isFlipped}
              onFlip={flip}
              onUnflip={unflip}
              onKnown={markKnown}
              onUnknown={markUnknown}
              knownWords={stack.cards.filter((c) => c.cardType === 2).map((c) => c.front)}
              expanded
            />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No cards available.</Text>
            </View>
          )}
        </View>
      </View>

      <SessionHud
        phase={state.phase}
        shortTermCount={shortTermCount}
        endOfDayCount={endOfDayCount}
        progress={sessionProgress}
        totalCards={totalSessionCards}
        cardsExitedLoop={cardsExitedLoop}
        goalType={goal.type}
        goalMinutes={goal.type === "time" ? goal.target : 0}
        sessionStartTime={state.sessionStartTime}
        onJumpToShortTerm={canJumpShortTerm ? jumpToShortTerm : undefined}
        onJumpToEndOfDay={canJumpEndOfDay ? jumpToEndOfDay : undefined}
      />
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
    paddingVertical: 10,
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
    fontSize: 20,
    fontWeight: "600",
    flex: 1,
    color: colors.foreground,
  },
  main: {
    flex: 1,
    minHeight: 0,
  },
  phaseLabel: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  cardArea: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
  },
  emptyCard: {
    flex: 1,
    marginVertical: 8,
    padding: 32,
    backgroundColor: colors.card,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 16,
  },
})
