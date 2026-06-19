import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import AppPressable from "./AppPressable"
import { SafeAreaView } from "react-native-safe-area-context"
import type { Card, Stack } from "../types"
import { colors } from "../theme/colors"
import { detectLanguage, detectLevel, getRecentWords } from "../lib/language-utils"
import { getTodayString, addDays } from "../lib/spaced-repetition"
import StoryReader from "./StoryReader"
import { useLocalStorage } from "../hooks/use-local-storage"
import {
  fetchNhkEasyArticles,
  loadCuratedStory,
  loadNhkArticleById,
  pickAndLoadCuratedStory,
  rankCuratedStories,
  type NhkEasyArticle,
  type RankedStory,
  type ReadTime,
  type ReadingHistory,
  type TokenizedStory,
} from "../lib/reading"

type Screen = "setup" | "loading" | "reading" | "feedback"
type Difficulty = "too-easy" | "just-right" | "too-hard"
type ReadingMode = "curated" | "nhk"

const READ_TIME_LABELS: Record<ReadTime, { label: string; desc: string }> = {
  short: { label: "Short", desc: "~2 min" },
  medium: { label: "Medium", desc: "~5 min" },
  long: { label: "Long", desc: "~10 min" },
}

interface GuidedReadingScreenProps {
  stack: Stack
  onBack: () => void
  onUpdateStack?: (stack: Stack) => void
}

export default function GuidedReadingScreen({ stack, onBack, onUpdateStack }: GuidedReadingScreenProps) {
  const [screen, setScreen] = useState<Screen>("setup")
  const [readTime, setReadTime] = useState<ReadTime>("medium")
  const [error, setError] = useState("")
  const [story, setStory] = useState<TokenizedStory | null>(null)
  const [localStack, setLocalStack] = useState(stack)
  const [rankedStories, setRankedStories] = useState<RankedStory[]>([])
  const [nhkArticles, setNhkArticles] = useState<NhkEasyArticle[]>([])
  const [nhkLoading, setNhkLoading] = useState(false)
  const [nhkError, setNhkError] = useState("")
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null)
  const [selectedNhkId, setSelectedNhkId] = useState<string | null>(null)
  const [readingMode, setReadingMode] = useState<ReadingMode>("nhk")
  const [readHistory, setReadHistory] = useLocalStorage<ReadingHistory>(
    `focusaurus-reading-history:${stack.id}`,
    { curated: [], nhk: [] },
  )

  const language = detectLanguage(stack.cards)
  const level = detectLevel(stack.cards)
  const recentWords = useMemo(() => getRecentWords(stack, 7).map((c) => c.front), [stack])
  const knownWords = useMemo(() => stack.cards.filter((c) => c.cardType === 2).map((c) => c.front), [stack])
  const isJapanese = language === "Japanese"

  useEffect(() => {
    setLocalStack(stack)
  }, [stack])

  useEffect(() => {
    if (!isJapanese) return
    const ranked = rankCuratedStories({ recentWords, knownWords, level, readTime })
    setRankedStories(ranked)
    const unread = ranked.filter((r) => !readHistory.curated.includes(r.story.id))
    const defaultPick = unread[0]?.story.id ?? ranked[0]?.story.id ?? null
    setSelectedStoryId((prev) => {
      if (prev && ranked.some((r) => r.story.id === prev)) return prev
      return defaultPick
    })
  }, [isJapanese, recentWords, knownWords, level, readTime, readHistory.curated])

  const loadNhkArticles = (cancelled = () => false) => {
    setNhkLoading(true)
    setNhkError("")
    return fetchNhkEasyArticles()
      .then((articles) => {
        if (cancelled()) return
        setNhkArticles(articles)
        const unread = articles.filter((a) => !readHistory.nhk.includes(a.id))
        const defaultPick = unread[0]?.id ?? articles[0]?.id ?? null
        setSelectedNhkId((prev) => {
          if (prev && articles.some((a) => a.id === prev)) return prev
          return defaultPick
        })
      })
      .catch((err: unknown) => {
        if (cancelled()) return
        setNhkArticles([])
        const message = err instanceof Error ? err.message : "Could not load NHK articles"
        setNhkError(message)
      })
      .finally(() => {
        if (!cancelled()) setNhkLoading(false)
      })
  }

  useEffect(() => {
    if (!isJapanese) return
    let cancelled = false
    loadNhkArticles(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [isJapanese, readHistory.nhk])

  const handleAddCard = (card: Card) => {
    const updated: Stack = { ...localStack, cards: [...localStack.cards, card] }
    setLocalStack(updated)
    onUpdateStack?.(updated)
  }

  const handleBumpCard = (cardId: string) => {
    const tomorrow = addDays(getTodayString(), 1)
    const updated: Stack = {
      ...localStack,
      cards: localStack.cards.map((c) =>
        c.id === cardId ? { ...c, nextReviewDate: tomorrow, interval: 1 } : c,
      ),
    }
    setLocalStack(updated)
    onUpdateStack?.(updated)
  }

  const markStoryRead = (loaded: TokenizedStory) => {
    if (!loaded.sourceId) return
    if (loaded.source === "curated") {
      setReadHistory((prev) => ({
        ...prev,
        curated: [loaded.sourceId!, ...prev.curated.filter((id) => id !== loaded.sourceId)].slice(0, 30),
      }))
    } else if (loaded.source === "nhk-easy") {
      setReadHistory((prev) => ({
        ...prev,
        nhk: [loaded.sourceId!, ...prev.nhk.filter((id) => id !== loaded.sourceId)].slice(0, 30),
      }))
    }
  }

  const openStory = async (loader: () => Promise<TokenizedStory> | TokenizedStory) => {
    setError("")
    setScreen("loading")
    try {
      const loaded = await loader()
      markStoryRead(loaded)
      setStory(loaded)
      setScreen("reading")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load story")
      setScreen("setup")
    }
  }

  const curatedPickOptions = () => ({
    recentWords,
    knownWords,
    level,
    readTime,
    stackCards: localStack.cards,
    recentlyReadIds: readHistory.curated,
  })

  const handleBestMatch = () => {
    if (!isJapanese) {
      setError("Guided reading stories are currently available for Japanese stacks.")
      return
    }
    openStory(() => pickAndLoadCuratedStory(curatedPickOptions()))
  }

  const handleReadAnother = () => {
    if (story?.source === "nhk-easy") {
      const unread = nhkArticles.filter((a) => !readHistory.nhk.includes(a.id))
      const pool = unread.length > 0 ? unread : nhkArticles
      const next = pool[Math.floor(Math.random() * Math.min(3, pool.length))] ?? pool[0]
      if (next) openStory(() => loadNhkArticleById(next.id, localStack.cards))
      return
    }
    openStory(() => pickAndLoadCuratedStory(curatedPickOptions()))
  }

  const handleLoadSelectedCurated = () => {
    const picked = rankedStories.find((r) => r.story.id === selectedStoryId)?.story
    if (!picked) return
    openStory(() => loadCuratedStory(picked, localStack.cards))
  }

  const handleReadTodaysNews = () => {
    const unread = nhkArticles.filter((a) => !readHistory.nhk.includes(a.id))
    const pool = unread.length > 0 ? unread : nhkArticles
    const pick = pool[0]
    if (!pick) {
      setError(nhkError || "No NHK articles available. Try again.")
      return
    }
    openStory(() => loadNhkArticleById(pick.id, localStack.cards))
  }

  const handleLoadSelectedNhk = () => {
    if (!selectedNhkId) return
    openStory(() => loadNhkArticleById(selectedNhkId, localStack.cards))
  }

  const handleFeedback = (difficulty: Difficulty) => {
    console.log("Reading feedback:", difficulty)
    setStory(null)
    setScreen("setup")
  }

  if (screen === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Preparing your story…</Text>
          <Text style={styles.loadingSubtext}>Matching vocabulary from your stack</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (screen === "reading" && story) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <AppPressable onPress={() => setScreen("setup")}>
            <Text style={styles.headerAction}>← Back</Text>
          </AppPressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Guided Reading
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <StoryReader
            title={story.title}
            tokens={story.tokens}
            stack={localStack}
            attribution={story.attribution}
            onAddCard={handleAddCard}
            onBumpCard={handleBumpCard}
          />
          <AppPressable style={styles.primaryBtn} onPress={() => setScreen("feedback")}>
            <Text style={styles.primaryBtnText}>I'm done reading</Text>
          </AppPressable>
          <AppPressable style={styles.secondaryBtn} onPress={handleReadAnother}>
            <Text style={styles.secondaryBtnText}>Read another story</Text>
          </AppPressable>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (screen === "feedback") {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.feedbackWrap}>
          <Text style={styles.feedbackTitle}>How was that?</Text>
          <Text style={styles.feedbackDesc}>Your feedback helps calibrate future stories.</Text>
          <View style={styles.feedbackRow}>
            <AppPressable style={styles.feedbackBtn} onPress={() => handleFeedback("too-easy")}>
              <Text style={styles.feedbackText}>Too Easy</Text>
            </AppPressable>
            <AppPressable style={styles.feedbackBtn} onPress={() => handleFeedback("just-right")}>
              <Text style={styles.feedbackText}>Just Right</Text>
            </AppPressable>
            <AppPressable style={styles.feedbackBtn} onPress={() => handleFeedback("too-hard")}>
              <Text style={styles.feedbackText}>Too Hard</Text>
            </AppPressable>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <AppPressable onPress={onBack}>
          <Text style={styles.headerAction}>← Back</Text>
        </AppPressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Guided Reading
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badges}>
          <Text style={styles.badge}>{language}</Text>
          <Text style={styles.badge}>{level}</Text>
          <Text style={styles.badge}>
            {recentWords.length > 0
              ? `${Math.min(recentWords.length, 20)} recent words`
              : "general vocabulary"}
          </Text>
        </View>

        {!isJapanese ? (
          <Text style={styles.note}>
            Story library is available for Japanese stacks. Other languages coming later.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Reading length</Text>
            <View style={styles.readTimeRow}>
              {(["short", "medium", "long"] as ReadTime[]).map((item) => (
                <AppPressable
                  key={item}
                  style={[styles.readTimeBtn, readTime === item && styles.readTimeBtnActive]}
                  onPress={() => setReadTime(item)}
                >
                  <Text style={readTime === item ? styles.readTimeTextActive : styles.readTimeText}>
                    {READ_TIME_LABELS[item].label}
                  </Text>
                  <Text style={readTime === item ? styles.readTimeDescActive : styles.readTimeDesc}>
                    {READ_TIME_LABELS[item].desc}
                  </Text>
                </AppPressable>
              ))}
            </View>

            <View style={styles.modeRow}>
              <AppPressable
                style={[styles.modeBtn, readingMode === "nhk" && styles.modeBtnActive]}
                onPress={() => setReadingMode("nhk")}
              >
                <Text style={readingMode === "nhk" ? styles.modeTextActive : styles.modeText}>
                  NHK Easy News
                </Text>
              </AppPressable>
              <AppPressable
                style={[styles.modeBtn, readingMode === "curated" && styles.modeBtnActive]}
                onPress={() => setReadingMode("curated")}
              >
                <Text style={readingMode === "curated" ? styles.modeTextActive : styles.modeText}>
                  Story library
                </Text>
              </AppPressable>
            </View>

            {readingMode === "nhk" ? (
              <>
                <Text style={styles.note}>
                  Fresh simplified news every day from NHK NEWS WEB EASY. Requires internet.
                </Text>
                {nhkLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                ) : nhkArticles.length === 0 ? (
                  <>
                    <Text style={styles.note}>
                      {nhkError || "Could not load NHK articles."}
                    </Text>
                    <AppPressable style={styles.secondaryBtn} onPress={() => loadNhkArticles()}>
                      <Text style={styles.secondaryBtnText}>Try again</Text>
                    </AppPressable>
                  </>
                ) : (
                  <>
                    <AppPressable style={styles.primaryBtn} onPress={handleReadTodaysNews}>
                      <Text style={styles.primaryBtnText}>Read today's top story</Text>
                    </AppPressable>
                    <Text style={styles.sectionTitle}>More from today</Text>
                    {nhkArticles.map((article) => {
                      const alreadyRead = readHistory.nhk.includes(article.id)
                      return (
                        <AppPressable
                          key={article.id}
                          style={[styles.storyCard, selectedNhkId === article.id && styles.storyCardActive]}
                          onPress={() => setSelectedNhkId(article.id)}
                        >
                          <Text style={styles.storyCardTitle}>{article.title}</Text>
                          <Text style={styles.storyCardMeta}>
                            {article.date}
                            {alreadyRead ? " · read" : ""}
                          </Text>
                        </AppPressable>
                      )
                    })}
                    <AppPressable
                      style={[styles.secondaryBtn, !selectedNhkId && styles.btnDisabled]}
                      onPress={handleLoadSelectedNhk}
                      disabled={!selectedNhkId}
                    >
                      <Text style={styles.secondaryBtnText}>Read selected article</Text>
                    </AppPressable>
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.note}>
                  {rankedStories.length} offline practice stories. Tap any word to look it up online.
                </Text>
                <AppPressable style={styles.primaryBtn} onPress={handleBestMatch}>
                  <Text style={styles.primaryBtnText}>Read next story for my vocab</Text>
                </AppPressable>

                <Text style={styles.sectionTitle}>Or pick a story</Text>
                {rankedStories.map(({ story: item, recentOverlap, totalOverlap }) => {
                  const alreadyRead = readHistory.curated.includes(item.id)
                  return (
                    <AppPressable
                      key={item.id}
                      style={[styles.storyCard, selectedStoryId === item.id && styles.storyCardActive]}
                      onPress={() => setSelectedStoryId(item.id)}
                    >
                      <Text style={styles.storyCardTitle}>{item.title}</Text>
                      <Text style={styles.storyCardMeta}>
                        {item.level} · {item.length}
                        {alreadyRead ? " · read" : ""}
                        {recentOverlap > 0
                          ? ` · ${recentOverlap} recent word${recentOverlap === 1 ? "" : "s"}`
                          : totalOverlap > 0
                            ? ` · ${totalOverlap} stack word${totalOverlap === 1 ? "" : "s"}`
                            : ""}
                      </Text>
                    </AppPressable>
                  )
                })}

                <AppPressable
                  style={[styles.secondaryBtn, !selectedStoryId && styles.btnDisabled]}
                  onPress={handleLoadSelectedCurated}
                  disabled={!selectedStoryId}
                >
                  <Text style={styles.secondaryBtnText}>Read selected story</Text>
                </AppPressable>
              </>
            )}
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.card,
  },
  headerAction: { color: colors.brand.teal, fontSize: 16, minWidth: 64 },
  headerTitle: { flex: 1, textAlign: "center", color: colors.foreground, fontWeight: "700", fontSize: 17 },
  headerSpacer: { minWidth: 64 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: colors.foreground,
    backgroundColor: colors.secondary,
    fontSize: 13,
  },
  label: { color: colors.muted, fontSize: 14, marginTop: 2 },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "700", marginTop: 8 },
  note: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  readTimeRow: { flexDirection: "row", gap: 8 },
  readTimeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 10,
    gap: 2,
  },
  readTimeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  readTimeText: { color: colors.foreground, fontWeight: "600" },
  readTimeTextActive: { color: colors.primaryForeground, fontWeight: "700" },
  readTimeDesc: { color: colors.muted, fontSize: 11 },
  readTimeDescActive: { color: colors.primaryForeground, fontSize: 11, opacity: 0.9 },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
  modeBtnActive: { backgroundColor: colors.secondary, borderColor: colors.primary },
  modeText: { color: colors.foreground, fontWeight: "600", fontSize: 14 },
  modeTextActive: { color: colors.foreground, fontWeight: "700", fontSize: 14 },
  storyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    backgroundColor: colors.card,
  },
  storyCardActive: { borderColor: colors.primary, backgroundColor: colors.secondary },
  storyCardTitle: { color: colors.foreground, fontSize: 16, fontWeight: "600" },
  storyCardMeta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  error: { color: colors.destructive, backgroundColor: colors.destructiveBg, padding: 10, borderRadius: 8 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  primaryBtnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 13,
  },
  secondaryBtnText: { color: colors.foreground, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  feedbackWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, gap: 14 },
  feedbackTitle: { color: colors.foreground, fontSize: 28, fontWeight: "700" },
  feedbackDesc: { color: colors.muted, textAlign: "center" },
  feedbackRow: { width: "100%", gap: 10 },
  feedbackBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  feedbackText: { color: colors.foreground, fontWeight: "600" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  loadingText: { color: colors.foreground, fontSize: 18, fontWeight: "600" },
  loadingSubtext: { color: colors.muted, fontSize: 14, textAlign: "center" },
})
