import { useEffect, useMemo, useRef, useState } from "react"
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import AppPressable from "./AppPressable"
import { SafeAreaView } from "react-native-safe-area-context"
import type { Stack, StudyGoal, GlobalSettings, TestStatsBucket, TestMode } from "../types"
import { isCardDueToday, getKnowledgeCheckPool } from "../lib/spaced-repetition"
import { EMPTY_TEST_STATS } from "../lib/stack-stats"
import { colors, radius } from "../theme/colors"
import StackEditScreen from "./StackEditScreen"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const PAGE_LABELS = ["Goal", "Test", "Info", "Edit"] as const
export const STACK_DETAIL_EDIT_PAGE = PAGE_LABELS.indexOf("Edit")
export const STACK_DETAIL_INFO_PAGE = PAGE_LABELS.indexOf("Info")

function useMountedPagerPages(activePage: number, initialPage: number) {
  const [mountedPages, setMountedPages] = useState(() => new Set([initialPage]))

  useEffect(() => {
    setMountedPages((prev) => {
      const next = new Set(prev)
      for (let i = 0; i < PAGE_LABELS.length; i++) {
        if (Math.abs(activePage - i) <= 1) next.add(i)
      }
      if (next.size === prev.size && [...next].every((i) => prev.has(i))) return prev
      return next
    })
  }, [activePage])

  useEffect(() => {
    setMountedPages((prev) => {
      if (prev.has(initialPage)) return prev
      const next = new Set(prev)
      next.add(initialPage)
      return next
    })
  }, [initialPage])

  return mountedPages
}

interface StackDetailScreenProps {
  stack: Stack
  globalSettings: GlobalSettings
  initialPage?: number
  sessionSummary?: "study" | "test"
  onBack: () => void
  onStartStudy: (goal: StudyGoal) => void
  onStartTest: (mode: TestMode) => void
  onUpdateStack: (stack: Stack) => void
  onDeleteStack: () => void
}

function defaultGoalTarget(
  type: "time" | "words",
  globalSettings: GlobalSettings,
  stack: Stack,
): string {
  if (globalSettings.useGlobalGoals) {
    return String(type === "time" ? globalSettings.defaultTimeGoal : globalSettings.defaultWordsGoal)
  }
  if (stack.savedGoal?.type === type) {
    return String(stack.savedGoal.target)
  }
  return String(type === "time" ? 15 : 10)
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return "Less than 1 min"
  return `${minutes} min`
}

function formatAvgPerCard(seconds: number): string {
  if (seconds <= 0) return "—"
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function testStatsForTab(stack: Stack, tab: "today" | "total"): TestStatsBucket {
  if (tab === "today") {
    return stack.todayTestStats ?? EMPTY_TEST_STATS
  }
  return stack.allTimeTestStats ?? EMPTY_TEST_STATS
}

export default function StackDetailScreen({
  stack,
  globalSettings,
  initialPage = 0,
  sessionSummary,
  onBack,
  onStartStudy,
  onStartTest,
  onUpdateStack,
  onDeleteStack,
}: StackDetailScreenProps) {
  const pagerRef = useRef<ScrollView>(null)
  const [page, setPage] = useState(initialPage)
  const [goalType, setGoalType] = useState<"time" | "words">(
    globalSettings.useGlobalGoals ? "time" : stack.savedGoal?.type || "time",
  )
  const [goalTarget, setGoalTarget] = useState(() =>
    defaultGoalTarget(
      globalSettings.useGlobalGoals ? "time" : stack.savedGoal?.type || "time",
      globalSettings,
      stack,
    ),
  )
  const [rememberSetting, setRememberSetting] = useState(stack.savedGoal?.rememberSetting ?? false)
  const [studyStatsTab, setStudyStatsTab] = useState<"today" | "total">("today")
  const [testStatsTab, setTestStatsTab] = useState<"today" | "total">("today")
  const [testMode, setTestMode] = useState<TestMode>("practice")
  const mountedPages = useMountedPagerPages(page, initialPage)

  const {
    learnedCards,
    dueToday,
    newCards,
    learnedPercent,
    knowledgeCheckPoolSize,
    knowledgeCheckSeen,
    knowledgeCheckRemaining,
  } = useMemo(() => {
    const pool = getKnowledgeCheckPool(stack.cards)
    const seenInCheck = new Set(stack.knowledgeCheckProgress?.seenCardIds ?? [])
    let learned = 0
    let due = 0
    let fresh = 0
    for (const card of stack.cards) {
      if (card.cardType === 2) learned++
      if (isCardDueToday(card)) due++
      if (card.cardType === 1 && !card.nextReviewDate) fresh++
    }
    const seen = pool.filter((card) => seenInCheck.has(card.id)).length
    return {
      learnedCards: learned,
      dueToday: due,
      newCards: fresh,
      learnedPercent:
        stack.cards.length > 0 ? Math.round((learned / stack.cards.length) * 100) : 0,
      knowledgeCheckPoolSize: pool.length,
      knowledgeCheckSeen: seen,
      knowledgeCheckRemaining: pool.length - seen,
    }
  }, [stack.cards, stack.knowledgeCheckProgress?.seenCardIds])

  const formatLastStudied = (date?: string) => {
    if (!date) return null
    const parsed = new Date(`${date}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  }

  const lastStudiedLabel = formatLastStudied(stack.lastStudied)
  const showStudySummary = sessionSummary === "study" && stack.lastStudySession
  const showTestSummary = sessionSummary === "test" && stack.lastTestSession
  const testStats = testStatsForTab(stack, testStatsTab)
  const hasTestHistory = (stack.allTimeTestStats?.sessionsCount ?? 0) > 0

  useEffect(() => {
    if (initialPage <= 0) return
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: initialPage * SCREEN_WIDTH, animated: false })
      setPage(initialPage)
    })
    return () => cancelAnimationFrame(frame)
  }, [initialPage])

  const goToPage = (index: number) => {
    pagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true })
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    if (nextPage >= 0 && nextPage < PAGE_LABELS.length && nextPage !== page) {
      setPage(nextPage)
    }
  }

  const selectGoalType = (type: "time" | "words") => {
    setGoalType(type)
    setGoalTarget(defaultGoalTarget(type, globalSettings, stack))
  }

  const handleStart = () => {
    const target = Math.max(1, parseInt(goalTarget, 10) || 15)
    const goal: StudyGoal = { type: goalType, target, rememberSetting }
    if (rememberSetting) {
      onUpdateStack({ ...stack, savedGoal: goal })
    }
    onStartStudy(goal)
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <AppPressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </AppPressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {stack.name}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.sheet}>
        <View style={styles.tabBar}>
          {PAGE_LABELS.map((label, index) => (
            <AppPressable
              key={label}
              style={styles.tab}
              onPress={() => goToPage(index)}
            >
              <Text style={[styles.tabText, page === index && styles.tabTextActive]}>{label}</Text>
              {page === index && <View style={styles.tabIndicator} />}
            </AppPressable>
          ))}
        </View>

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={styles.pager}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
        >
          {/* Goal */}
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            {mountedPages.has(0) ? (
            <ScrollView
              style={styles.pageScroll}
              contentContainerStyle={styles.goalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              <View style={styles.welcomeBlock}>
                <Image source={require("../../assets/icon.png")} style={styles.mascot} />
                <Text style={styles.welcomeTitle}>Welcome to your study session</Text>
                <Text style={styles.welcomeBrand}>with Focasaurus</Text>
                <Text style={styles.welcomeMeta}>
                  {stack.cards.length} card{stack.cards.length !== 1 ? "s" : ""}
                  {dueToday > 0 ? ` · ${dueToday} due today` : ""}
                </Text>
              </View>

              <View style={styles.goalBlock}>
                <Text style={styles.goalHeading}>Today's learning goal</Text>

                <View style={styles.goalTypeTabBar}>
                  <AppPressable
                    style={[styles.goalTypeTab, goalType === "time" && styles.goalTypeTabActive]}
                    onPress={() => selectGoalType("time")}
                  >
                    <Text
                      style={[
                        styles.goalTypeTabText,
                        goalType === "time" && styles.goalTypeTabTextActive,
                      ]}
                    >
                      Time
                    </Text>
                  </AppPressable>
                  <AppPressable
                    style={[styles.goalTypeTab, goalType === "words" && styles.goalTypeTabActive]}
                    onPress={() => selectGoalType("words")}
                  >
                    <Text
                      style={[
                        styles.goalTypeTabText,
                        goalType === "words" && styles.goalTypeTabTextActive,
                      ]}
                    >
                      Words
                    </Text>
                  </AppPressable>
                </View>

                <Text style={styles.goalInputLabel}>
                  {goalType === "time" ? "How many minutes?" : "How many words?"}
                </Text>
                <TextInput
                  style={styles.goalInput}
                  value={goalTarget}
                  onChangeText={setGoalTarget}
                  keyboardType="number-pad"
                  textAlign="center"
                />

                <AppPressable
                  style={styles.checkRow}
                  onPress={() => setRememberSetting(!rememberSetting)}
                >
                  <View style={[styles.checkbox, rememberSetting && styles.checkboxOn]} />
                  <Text style={styles.checkLabel}>Remember for this stack</Text>
                </AppPressable>
              </View>

              <AppPressable style={styles.startBtn} onPress={handleStart}>
                <Text style={styles.startText}>Start Studying</Text>
              </AppPressable>
            </ScrollView>
            ) : null}
          </View>

          {/* Test */}
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            {mountedPages.has(1) ? (
            <ScrollView
              style={styles.pageScroll}
              contentContainerStyle={styles.goalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              <View style={styles.welcomeBlock}>
                <Image source={require("../../assets/icon.png")} style={styles.mascot} />
                <Text style={styles.welcomeTitle}>
                  {testMode === "practice" ? "Practice test" : "Knowledge check"}
                </Text>
                <Text style={styles.welcomeBrand}>
                  {testMode === "practice" ? "see how prepped you are" : "one pass, no repeats"}
                </Text>
                <Text style={styles.welcomeMeta}>
                  {testMode === "practice"
                    ? `${stack.cards.length} card${stack.cards.length !== 1 ? "s" : ""} · English side first`
                    : `${knowledgeCheckPoolSize} unlearned · ${learnedCards} already learned`}
                </Text>
              </View>

              <View style={styles.goalBlock}>
                <Text style={styles.goalHeading}>Test type</Text>

                <View style={styles.goalTypeTabBar}>
                  <AppPressable
                    style={[styles.goalTypeTab, testMode === "practice" && styles.goalTypeTabActive]}
                    onPress={() => setTestMode("practice")}
                  >
                    <Text
                      style={[
                        styles.goalTypeTabText,
                        testMode === "practice" && styles.goalTypeTabTextActive,
                      ]}
                    >
                      Practice
                    </Text>
                  </AppPressable>
                  <AppPressable
                    style={[styles.goalTypeTab, testMode === "check" && styles.goalTypeTabActive]}
                    onPress={() => setTestMode("check")}
                  >
                    <Text
                      style={[
                        styles.goalTypeTabText,
                        testMode === "check" && styles.goalTypeTabTextActive,
                      ]}
                    >
                      Knowledge check
                    </Text>
                  </AppPressable>
                </View>

                {testMode === "practice" ? (
                  <>
                    <Text style={styles.testCopy}>
                      Every card is shuffled in. Flip each one and say whether you remembered it.
                    </Text>
                    <Text style={styles.testCopy}>
                      Get it right on the first try and it leaves the test. Miss it and it comes back
                      in four cards, then eight, then at the end — stepping closer each time you miss
                      it again.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.testCopy}>
                      Sort cards you haven't learned yet. Already-learned cards are skipped.
                      Each card appears once — know it or don't know — and your choices update
                      the stack (same as marking learned on the Edit tab).
                    </Text>
                    <Text style={styles.testCopy}>
                      Leave early and your progress is saved. When you come back, only unchecked
                      unlearned cards are shown.
                    </Text>
                    {knowledgeCheckSeen > 0 && knowledgeCheckPoolSize > 0 && (
                      <Text style={styles.testResumeCopy}>
                        {knowledgeCheckSeen} of {knowledgeCheckPoolSize} already checked ·{" "}
                        {knowledgeCheckRemaining} left
                      </Text>
                    )}
                  </>
                )}
              </View>

              <AppPressable
                style={[
                  styles.startBtn,
                  (stack.cards.length === 0 ||
                    (testMode === "check" &&
                      (knowledgeCheckPoolSize === 0 || knowledgeCheckRemaining === 0))) &&
                    styles.startBtnDisabled,
                ]}
                onPress={() => onStartTest(testMode)}
                disabled={
                  stack.cards.length === 0 ||
                  (testMode === "check" &&
                    (knowledgeCheckPoolSize === 0 || knowledgeCheckRemaining === 0))
                }
              >
                <Text style={styles.startText}>
                  {stack.cards.length === 0
                    ? "No cards to test"
                    : testMode === "check" && knowledgeCheckPoolSize === 0
                      ? "All cards learned"
                      : testMode === "check" && knowledgeCheckRemaining === 0
                        ? "Check complete"
                        : testMode === "check" && knowledgeCheckSeen > 0
                          ? "Continue check"
                          : testMode === "check"
                            ? "Start check"
                            : "Start test"}
                </Text>
              </AppPressable>
            </ScrollView>
            ) : null}
          </View>

          {/* Stack info */}
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            {mountedPages.has(2) ? (
            <ScrollView
              style={styles.pageScroll}
              contentContainerStyle={styles.infoScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              <View style={styles.infoHero}>
                {showStudySummary && stack.lastStudySession ? (
                  <>
                    <Text style={styles.infoTitle}>Your study session</Text>
                    <Text style={styles.infoSubtitle}>Session complete</Text>
                    <Text style={styles.infoMeta}>
                      {stack.lastStudySession.wordsStudied} word
                      {stack.lastStudySession.wordsStudied !== 1 ? "s" : ""} reviewed ·{" "}
                      {formatMinutes(stack.lastStudySession.timeSpentMinutes)}
                    </Text>
                  </>
                ) : showTestSummary && stack.lastTestSession ? (
                  <>
                    <Text style={styles.infoTitle}>Your test session</Text>
                    <Text style={styles.infoSubtitle}>Test complete</Text>
                    <Text style={styles.infoMeta}>
                      {stack.lastTestSession.cardsTotal} card
                      {stack.lastTestSession.cardsTotal !== 1 ? "s" : ""} cleared ·{" "}
                      {formatMinutes(stack.lastTestSession.durationMinutes)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.infoTitle}>Your progress</Text>
                    <Text style={styles.infoSubtitle}>at a glance</Text>
                    {lastStudiedLabel ? (
                      <Text style={styles.infoMeta}>Last studied {lastStudiedLabel}</Text>
                    ) : (
                      <Text style={styles.infoMeta}>No study sessions yet</Text>
                    )}
                  </>
                )}
              </View>

              {showStudySummary && stack.lastStudySession && (
                <View style={[styles.sessionBlock, styles.sessionHighlight]}>
                  <Text style={styles.blockHeading}>This session</Text>
                  <View style={styles.sessionStats}>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>{stack.lastStudySession.wordsStudied}</Text>
                      <Text style={styles.sessionStatLabel}>Words studied</Text>
                    </View>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>
                        {stack.lastStudySession.timeSpentMinutes}
                      </Text>
                      <Text style={styles.sessionStatLabel}>Minutes</Text>
                    </View>
                    {stack.lastStudySession.accuracy > 0 && (
                      <View style={styles.sessionStatCard}>
                        <Text style={styles.sessionStatNum}>{stack.lastStudySession.accuracy}%</Text>
                        <Text style={styles.sessionStatLabel}>Accuracy</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {showTestSummary && stack.lastTestSession && (
                <View style={[styles.sessionBlock, styles.sessionHighlight]}>
                  <Text style={styles.blockHeading}>This test</Text>
                  <View style={styles.sessionStats}>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>{stack.lastTestSession.accuracy}%</Text>
                      <Text style={styles.sessionStatLabel}>First-pass accuracy</Text>
                    </View>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>
                        {formatAvgPerCard(stack.lastTestSession.avgSecondsPerCard)}
                      </Text>
                      <Text style={styles.sessionStatLabel}>Avg time per card</Text>
                    </View>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>
                        {formatMinutes(stack.lastTestSession.durationMinutes)}
                      </Text>
                      <Text style={styles.sessionStatLabel}>Test duration</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.progressBlock}>
                <Text style={styles.blockHeading}>Stack breakdown</Text>

                <View style={styles.progressRing}>
                  <Text style={styles.progressPercent}>{learnedPercent}%</Text>
                  <Text style={styles.progressLabel}>learned</Text>
                </View>

                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${learnedPercent}%` }]} />
                </View>

                <View style={styles.breakdownGrid}>
                  <View style={styles.breakdownCell}>
                    <Text style={styles.breakdownNum}>{stack.cards.length}</Text>
                    <Text style={styles.breakdownLabel}>Total</Text>
                  </View>
                  <View style={styles.breakdownCell}>
                    <Text style={[styles.breakdownNum, styles.breakdownNumPrimary]}>
                      {learnedCards}
                    </Text>
                    <Text style={styles.breakdownLabel}>Learned</Text>
                  </View>
                  <View style={styles.breakdownCell}>
                    <Text style={styles.breakdownNum}>{newCards}</Text>
                    <Text style={styles.breakdownLabel}>New</Text>
                  </View>
                  <View style={styles.breakdownCell}>
                    <Text style={[styles.breakdownNum, dueToday > 0 && styles.breakdownNumAccent]}>
                      {dueToday}
                    </Text>
                    <Text style={styles.breakdownLabel}>Due</Text>
                  </View>
                </View>

                {dueToday > 0 && (
                  <View style={styles.dueBanner}>
                    <Text style={styles.dueBannerText}>
                      {dueToday} card{dueToday !== 1 ? "s" : ""} ready for review today
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.sessionBlock}>
                <Text style={styles.blockHeading}>Study activity</Text>

                <View style={styles.goalTypeTabBar}>
                  <AppPressable
                    style={[styles.goalTypeTab, studyStatsTab === "today" && styles.goalTypeTabActive]}
                    onPress={() => setStudyStatsTab("today")}
                  >
                    <Text
                      style={[
                        styles.goalTypeTabText,
                        studyStatsTab === "today" && styles.goalTypeTabTextActive,
                      ]}
                    >
                      Today
                    </Text>
                  </AppPressable>
                  <AppPressable
                    style={[styles.goalTypeTab, studyStatsTab === "total" && styles.goalTypeTabActive]}
                    onPress={() => setStudyStatsTab("total")}
                  >
                    <Text
                      style={[
                        styles.goalTypeTabText,
                        studyStatsTab === "total" && styles.goalTypeTabTextActive,
                      ]}
                    >
                      All time
                    </Text>
                  </AppPressable>
                </View>

                {studyStatsTab === "today" ? (
                  <View style={styles.sessionStats}>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>{stack.todayStats.wordsStudied}</Text>
                      <Text style={styles.sessionStatLabel}>Words studied</Text>
                    </View>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>{stack.todayStats.timeSpent}</Text>
                      <Text style={styles.sessionStatLabel}>Minutes spent</Text>
                    </View>
                    {stack.todayStats.accuracy > 0 && (
                      <View style={styles.sessionStatCard}>
                        <Text style={styles.sessionStatNum}>{stack.todayStats.accuracy}%</Text>
                        <Text style={styles.sessionStatLabel}>Accuracy</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.sessionStats}>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>{stack.allTimeStats.wordsStudied}</Text>
                      <Text style={styles.sessionStatLabel}>Words studied</Text>
                    </View>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>{stack.allTimeStats.timeSpent}</Text>
                      <Text style={styles.sessionStatLabel}>Minutes spent</Text>
                    </View>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>{stack.allTimeStats.sessionsCount}</Text>
                      <Text style={styles.sessionStatLabel}>Sessions</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.sessionBlock}>
                <Text style={styles.blockHeading}>Test activity</Text>

                <View style={styles.goalTypeTabBar}>
                  <AppPressable
                    style={[styles.goalTypeTab, testStatsTab === "today" && styles.goalTypeTabActive]}
                    onPress={() => setTestStatsTab("today")}
                  >
                    <Text
                      style={[
                        styles.goalTypeTabText,
                        testStatsTab === "today" && styles.goalTypeTabTextActive,
                      ]}
                    >
                      Today
                    </Text>
                  </AppPressable>
                  <AppPressable
                    style={[styles.goalTypeTab, testStatsTab === "total" && styles.goalTypeTabActive]}
                    onPress={() => setTestStatsTab("total")}
                  >
                    <Text
                      style={[
                        styles.goalTypeTabText,
                        testStatsTab === "total" && styles.goalTypeTabTextActive,
                      ]}
                    >
                      All time
                    </Text>
                  </AppPressable>
                </View>

                {hasTestHistory || testStats.sessionsCount > 0 ? (
                  <View style={styles.sessionStats}>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>{testStats.accuracy}%</Text>
                      <Text style={styles.sessionStatLabel}>Accuracy</Text>
                    </View>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>
                        {formatAvgPerCard(testStats.avgSecondsPerCard)}
                      </Text>
                      <Text style={styles.sessionStatLabel}>Avg time per card</Text>
                    </View>
                    <View style={styles.sessionStatCard}>
                      <Text style={styles.sessionStatNum}>
                        {formatMinutes(testStats.durationMinutes)}
                      </Text>
                      <Text style={styles.sessionStatLabel}>Test duration</Text>
                    </View>
                    {testStatsTab === "total" && (
                      <View style={styles.sessionStatCard}>
                        <Text style={styles.sessionStatNum}>{testStats.sessionsCount}</Text>
                        <Text style={styles.sessionStatLabel}>Tests</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.emptyStatsCopy}>
                    No test sessions yet. Finish a stack test to see accuracy, pacing, and duration
                    here.
                  </Text>
                )}
              </View>
            </ScrollView>
            ) : null}
          </View>

          {/* Edit */}
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            {mountedPages.has(3) ? (
            <StackEditScreen
              key={stack.id}
              embedded
              stack={stack}
              onUpdateStack={onUpdateStack}
              onDeleteStack={onDeleteStack}
            />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  backText: { fontSize: 16, color: colors.primary, minWidth: 56 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    color: colors.foreground,
  },
  headerSpacer: { minWidth: 56 },
  sheet: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 10,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "20%",
    right: "20%",
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  pager: { flex: 1 },
  page: { flex: 1 },
  pageScroll: { flex: 1 },
  goalScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  welcomeBlock: {
    alignItems: "center",
    marginBottom: 32,
  },
  mascot: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 28,
  },
  welcomeBrand: {
    fontSize: 17,
    fontWeight: "500",
    color: colors.primary,
    marginTop: 4,
    textAlign: "center",
  },
  welcomeMeta: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 10,
    textAlign: "center",
  },
  goalBlock: {
    flex: 1,
    backgroundColor: colors.tealBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 24,
  },
  goalHeading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    textAlign: "center",
    marginBottom: 16,
  },
  goalTypeTabBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
    marginBottom: 24,
  },
  goalTypeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  goalTypeTabActive: {
    backgroundColor: colors.primary,
  },
  goalTypeTabText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.muted,
  },
  goalTypeTabTextActive: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  goalInputLabel: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 10,
  },
  goalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 32,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 20,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: radius.sm,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { fontSize: 15, color: colors.foreground },
  startBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: "auto",
  },
  startBtnDisabled: {
    opacity: 0.5,
  },
  startText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 17 },
  testCopy: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
    marginBottom: 12,
  },
  testResumeCopy: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "center",
    marginTop: 4,
  },
  infoScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 24,
  },
  infoHero: {
    alignItems: "center",
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 28,
  },
  infoSubtitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
    lineHeight: 28,
  },
  infoMeta: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 10,
    textAlign: "center",
  },
  blockHeading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    textAlign: "center",
    marginBottom: 16,
  },
  progressBlock: {
    backgroundColor: colors.tealBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  progressRing: {
    alignItems: "center",
    marginBottom: 16,
  },
  progressPercent: {
    fontSize: 44,
    fontWeight: "700",
    color: colors.primary,
    lineHeight: 48,
  },
  progressLabel: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.card,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  breakdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  breakdownCell: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  breakdownNum: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.foreground,
  },
  breakdownNumPrimary: {
    color: colors.primary,
  },
  breakdownNumAccent: {
    color: colors.brand.gold,
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    fontWeight: "500",
  },
  dueBanner: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dueBannerText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "center",
  },
  sessionBlock: {
    backgroundColor: colors.tealBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  sessionHighlight: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  sessionStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  sessionStatCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  sessionStatNum: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.foreground,
  },
  sessionStatLabel: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
    textAlign: "center",
  },
  emptyStatsCopy: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 4,
  },
})
