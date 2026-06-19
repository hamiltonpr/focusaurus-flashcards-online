"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, BookOpen, Loader2, Clock, ThumbsUp, ThumbsDown, Minus } from "lucide-react"
import type { Stack, Card as FlashCard } from "../types"
import type { GeneratedStory } from "../api/generate-story/route"
import StoryReader from "./story-reader"
import { detectLanguage, detectLevel, getRecentWords } from "../lib/language-utils"
import { getTodayString, addDays } from "../lib/spaced-repetition"

interface GuidedReadingPageProps {
  stack: Stack
  onBack: () => void
  onUpdateStack: (stack: Stack) => void
}

type Screen = "setup" | "loading" | "reading" | "feedback"
type ReadTime = "short" | "medium" | "long"
type Difficulty = "too-easy" | "just-right" | "too-hard"

const READ_TIME_LABELS: Record<ReadTime, { label: string; desc: string; icon: string }> = {
  short: { label: "Short", desc: "~2 min", icon: "⚡" },
  medium: { label: "Medium", desc: "~5 min", icon: "📖" },
  long: { label: "Long", desc: "~10 min", icon: "📚" },
}

const TOPIC_SUGGESTIONS = [
  "A normal day in town",
  "A funny misunderstanding",
  "A short mystery",
  "Two friends planning a trip",
  "A family dinner conversation",
]

const EXAMPLE_STORY: GeneratedStory = {
  title: "小さなキツネの物語",
  tokens: [
    { text: "昔々", reading: "むかしむかし", definition: "Once upon a time", isWord: true },
    { text: "、", isWord: false },
    { text: "ある", definition: "a certain; one", isWord: true },
    { text: "森", reading: "もり", definition: "forest", isWord: true },
    { text: "に", isWord: false },
    { text: "小さな", reading: "ちいさな", definition: "small; little", isWord: true },
    { text: "キツネ", definition: "fox", isWord: true },
    { text: "が", isWord: false },
    { text: "住んでいました", reading: "すんでいました", definition: "was living; lived", isWord: true },
    { text: "。\n\n", isWord: false },
    { text: "キツネ", definition: "fox", isWord: true },
    { text: "は", isWord: false },
    { text: "毎日", reading: "まいにち", definition: "every day", isWord: true },
    { text: "、", isWord: false },
    { text: "おいしい", definition: "delicious; tasty", isWord: true },
    { text: "食べ物", reading: "たべもの", definition: "food", isWord: true },
    { text: "を", isWord: false },
    { text: "探して", reading: "さがして", definition: "searching for; looking for", isWord: true },
    { text: "歩き回りました", reading: "あるきまわりました", definition: "walked around; wandered", isWord: true },
    { text: "。\n\n", isWord: false },
    { text: "ある日", reading: "あるひ", definition: "one day", isWord: true },
    { text: "、", isWord: false },
    { text: "キツネ", definition: "fox", isWord: true },
    { text: "は", isWord: false },
    { text: "木", reading: "き", definition: "tree", isWord: true },
    { text: "の", isWord: false },
    { text: "下", reading: "した", definition: "under; below", isWord: true },
    { text: "で", isWord: false },
    { text: "きれいな", definition: "beautiful; pretty", isWord: true },
    { text: "青い", reading: "あおい", definition: "blue", isWord: true },
    { text: "花", reading: "はな", definition: "flower", isWord: true },
    { text: "を", isWord: false },
    { text: "見つけました", reading: "みつけました", definition: "found; discovered", isWord: true },
    { text: "。\n\n", isWord: false },
    { text: "キツネ", definition: "fox", isWord: true },
    { text: "は", isWord: false },
    { text: "その", definition: "that; the", isWord: true },
    { text: "花", reading: "はな", definition: "flower", isWord: true },
    { text: "を", isWord: false },
    { text: "大切にして", reading: "たいせつにして", definition: "treasured; cherished", isWord: true },
    { text: "、", isWord: false },
    { text: "とても", definition: "very; extremely", isWord: true },
    { text: "幸せな", reading: "しあわせな", definition: "happy; blissful", isWord: true },
    { text: "気持ち", reading: "きもち", definition: "feeling; emotion", isWord: true },
    { text: "に", isWord: false },
    { text: "なりました", definition: "became", isWord: true },
    { text: "。", isWord: false },
  ],
}

export default function GuidedReadingPage({ stack, onBack, onUpdateStack }: GuidedReadingPageProps) {
  const [screen, setScreen] = useState<Screen>("setup")
  const [readTime, setReadTime] = useState<ReadTime>("medium")
  const [topic, setTopic] = useState("")
  const [story, setStory] = useState<GeneratedStory | null>(null)
  const [error, setError] = useState("")
  const [localStack, setLocalStack] = useState(stack)
  const [lastGeneratedTopic, setLastGeneratedTopic] = useState("")

  const language = detectLanguage(stack.cards)
  const level = detectLevel(stack.cards)
  const recentWords = getRecentWords(stack, 7).map((c) => c.front)
  const knownWords = stack.cards.filter((c) => c.cardType === 2).map((c) => c.front)
  const canGenerate = useMemo(() => localStack.cards.length > 0, [localStack.cards.length])

  useEffect(() => {
    setLocalStack(stack)
  }, [stack])

  const handleGenerate = async () => {
    setError("")
    setScreen("loading")
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recentWords, knownWords, readTime, topic, level, language }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "API error")
      }
      const data: GeneratedStory = await res.json()
      setStory(data)
      setLastGeneratedTopic(topic.trim())
      setScreen("reading")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate story")
      setScreen("setup")
    }
  }

  const handleAddCard = (card: FlashCard) => {
    const updated: Stack = { ...localStack, cards: [...localStack.cards, card] }
    setLocalStack(updated)
    onUpdateStack(updated)
  }

  const handleBumpCard = (cardId: string) => {
    // Set the card's nextReviewDate to tomorrow with interval 1 so it appears at the top
    const tomorrow = addDays(getTodayString(), 1)
    const updated: Stack = {
      ...localStack,
      cards: localStack.cards.map((c) =>
        c.id === cardId ? { ...c, nextReviewDate: tomorrow, interval: 1 } : c,
      ),
    }
    setLocalStack(updated)
    onUpdateStack(updated)
  }

  const handleFeedback = (difficulty: Difficulty) => {
    // Future: store difficulty to calibrate future stories
    console.log("Reading difficulty feedback:", difficulty)
    setScreen("setup")
    setStory(null)
    setTopic("")
  }

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (screen === "setup") {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Guided Reading
          </h2>
        </div>

        {/* Language + level badge */}
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="bg-muted px-2 py-1 rounded">{language}</span>
          <span className="bg-muted px-2 py-1 rounded capitalize">{level}</span>
          <span className="bg-muted px-2 py-1 rounded">
            {recentWords.length > 0
              ? `Focusing on ${Math.min(recentWords.length, 20)} recent words`
              : "No recent words — story will use general vocabulary"}
          </span>
        </div>

        {/* Read time selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              How long do you want to read?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["short", "medium", "long"] as ReadTime[]).map((rt) => {
                const { label, desc, icon } = READ_TIME_LABELS[rt]
                return (
                  <button
                    key={rt}
                    onClick={() => setReadTime(rt)}
                    className={`flex flex-col items-center justify-center p-4 rounded-sm border transition-colors ${
                      readTime === rt
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <span className="text-2xl mb-1">{icon}</span>
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Topic prompt */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What do you want to read about? (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={`e.g. "A day at the market", "A conversation between friends", "A short mystery story"…`}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank and we'll pick something interesting for your level.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {TOPIC_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setTopic(suggestion)}
                  className="rounded-sm border px-3 py-1 text-xs hover:bg-muted"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</p>}

        {!canGenerate && (
          <p className="text-sm text-muted-foreground bg-muted/40 p-3 rounded">
            Add at least one card to this stack before generating a story.
          </p>
        )}

        <Button size="lg" className="w-full" onClick={handleGenerate} disabled={!canGenerate}>
          <BookOpen className="w-4 h-4 mr-2" />
          Generate Story
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs text-muted-foreground">
            <span className="bg-background px-2">or try without API</span>
          </div>
        </div>

        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={() => { setStory(EXAMPLE_STORY); setScreen("reading") }}
        >
          📖 Load Example Story (キツネの物語)
        </Button>
      </div>
    )
  }

  // ── Loading screen ────────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-muted-foreground">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="text-lg">Writing your story…</p>
        <p className="text-sm">Using your recently studied words</p>
      </div>
    )
  }

  // ── Reading screen ────────────────────────────────────────────────────────
  if (screen === "reading" && story) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setScreen("setup")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleGenerate} disabled={!canGenerate}>
              Generate another
            </Button>
            <Button onClick={() => setScreen("feedback")}>
            Done reading →
            </Button>
          </div>
        </div>

        {lastGeneratedTopic && (
          <p className="text-sm text-muted-foreground">Topic: {lastGeneratedTopic}</p>
        )}

        <StoryReader
          title={story.title}
          tokens={story.tokens}
          language={language}
          stack={localStack}
          onAddCard={handleAddCard}
          onBumpCard={handleBumpCard}
        />

        {/* Sticky done button */}
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-background/90 backdrop-blur border-t">
          <div className="max-w-2xl mx-auto">
            <Button size="lg" className="w-full" onClick={() => setScreen("feedback")}>
              I'm done reading →
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Feedback screen ───────────────────────────────────────────────────────
  if (screen === "feedback") {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center gap-6 pt-12">
        <h2 className="text-2xl font-bold">How was that?</h2>
        <p className="text-muted-foreground text-center">
          Your feedback helps calibrate the difficulty of future stories.
        </p>
        <div className="grid grid-cols-3 gap-3 w-full">
          <button
            onClick={() => handleFeedback("too-easy")}
            className="flex flex-col items-center p-4 rounded-sm border border-border hover:border-primary hover:bg-primary/5 transition-colors gap-2"
          >
            <ThumbsUp className="w-8 h-8 text-primary" />
            <span className="font-medium text-sm">Too Easy</span>
          </button>
          <button
            onClick={() => handleFeedback("just-right")}
            className="flex flex-col items-center p-4 rounded-sm border border-border hover:border-primary hover:bg-primary/5 transition-colors gap-2"
          >
            <Minus className="w-8 h-8 text-primary" />
            <span className="font-medium text-sm">Just Right</span>
          </button>
          <button
            onClick={() => handleFeedback("too-hard")}
            className="flex flex-col items-center p-4 rounded-sm border border-border hover:border-destructive hover:bg-destructive/10 transition-colors gap-2"
          >
            <ThumbsDown className="w-8 h-8 text-destructive" />
            <span className="font-medium text-sm">Too Hard</span>
          </button>
        </div>
      </div>
    )
  }

  return null
}
