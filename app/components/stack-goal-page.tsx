"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Settings, Play, FileText, BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
import type { Stack, StudyGoal, GlobalSettings } from "../types"
import StackSettingsDialog from "./stack-settings-dialog"
import { isCardDueToday } from "../lib/spaced-repetition"

const PAGE_LABELS = ["Goal", "Reading", "Info"] as const

interface StackGoalPageProps {
  stack: Stack
  onBack: () => void
  onUpdateStack: (stack: Stack) => void
  onStartStudy: (goal: StudyGoal) => void
  onStartReading: () => void
  globalSettings: GlobalSettings
}

export default function StackGoalPage({
  stack,
  onBack,
  onUpdateStack,
  onStartStudy,
  onStartReading,
  globalSettings,
}: StackGoalPageProps) {
  const pagerRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const [goalType, setGoalType] = useState<"time" | "words">(
    globalSettings.useGlobalGoals ? "time" : stack.savedGoal?.type || "time",
  )
  const [goalTarget, setGoalTarget] = useState(
    globalSettings.useGlobalGoals
      ? goalType === "time"
        ? globalSettings.defaultTimeGoal
        : globalSettings.defaultWordsGoal
      : stack.savedGoal?.target || 15,
  )
  const [rememberSetting, setRememberSetting] = useState(stack.savedGoal?.rememberSetting || false)
  const [showStackSettings, setShowStackSettings] = useState(false)
  const [statsTab, setStatsTab] = useState<"today" | "total">("today")

  const learnedCards = stack.cards.filter((c) => c.cardType === 2).length
  const dueToday = stack.cards.filter(isCardDueToday).length
  const newCards = stack.cards.filter((c) => c.cardType === 1 && !c.nextReviewDate).length

  const goToPage = (index: number) => {
    const el = pagerRef.current
    if (!el) return
    const slide = el.children[index] as HTMLElement | undefined
    if (!slide) return
    el.scrollTo({ left: slide.offsetLeft, behavior: "smooth" })
    setPage(index)
  }

  const handlePagerScroll = () => {
    const el = pagerRef.current
    if (!el || el.children.length === 0) return
    const scrollLeft = el.scrollLeft
    let closest = 0
    let minDist = Infinity
    Array.from(el.children).forEach((child, index) => {
      const offset = (child as HTMLElement).offsetLeft
      const dist = Math.abs(offset - scrollLeft)
      if (dist < minDist) {
        minDist = dist
        closest = index
      }
    })
    setPage(closest)
  }

  const canGoBack = page > 0
  const canGoForward = page < PAGE_LABELS.length - 1
  const nextLabel = canGoForward ? PAGE_LABELS[page + 1] : null
  const prevLabel = canGoBack ? PAGE_LABELS[page - 1] : null

  const handleStart = (mode: "study" | "test") => {
    const goal: StudyGoal = { type: goalType, target: goalTarget, rememberSetting }
    if (rememberSetting) {
      onUpdateStack({ ...stack, savedGoal: goal })
    }
    if (mode === "study" || mode === "test") {
      onStartStudy(goal)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h2 className="text-lg font-semibold truncate flex-1 text-center">{stack.name}</h2>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => setShowStackSettings(true)}
          aria-label="Edit stack"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => goToPage(page - 1)}
            disabled={!canGoBack}
            aria-label="Previous section"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex flex-1 rounded-sm border bg-card p-1 gap-1">
            {PAGE_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => goToPage(index)}
                className={`flex-1 rounded-sm px-2 py-2 text-sm font-medium transition-colors ${
                  page === index
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => goToPage(page + 1)}
            disabled={!canGoForward}
            aria-label="Next section"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground min-h-4">
          {canGoForward
            ? `Swipe or tap › for ${nextLabel}`
            : canGoBack
              ? `Swipe or tap ‹ for ${prevLabel}`
              : null}
        </p>
      </div>

      <div
        ref={pagerRef}
        onScroll={handlePagerScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-2 px-2 pb-1"
      >
        {/* Goal */}
        <div className="w-[88%] sm:w-[85%] max-w-md flex-shrink-0 snap-center">
          <Card className="h-full border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-lg">Today&apos;s Learning Goal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <RadioGroup value={goalType} onValueChange={(value: "time" | "words") => setGoalType(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="time" id="time" />
                  <Label htmlFor="time">Time Goal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="words" id="words" />
                  <Label htmlFor="words">Words to Learn Goal</Label>
                </div>
              </RadioGroup>

              <div className="space-y-2">
                <Label htmlFor="target">
                  {goalType === "time" ? "Minutes to study" : "Number of words to learn"}
                </Label>
                <Input
                  id="target"
                  type="number"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(Number(e.target.value))}
                  min="1"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberSetting}
                  onCheckedChange={(checked) => setRememberSetting(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm">
                  Remember this setting for this stack
                </Label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => handleStart("study")} className="w-full sm:flex-1" size="lg">
                  <Play className="w-4 h-4 mr-2" />
                  Start Studying
                </Button>
                <Button onClick={() => handleStart("test")} variant="outline" className="w-full sm:flex-1" size="lg">
                  <FileText className="w-4 h-4 mr-2" />
                  Test Review
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Guided reading */}
        <div className="w-[88%] sm:w-[85%] max-w-md flex-shrink-0 snap-center">
          <Card className="h-full border shadow-sm">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="text-4xl">📖</div>
              <h3 className="text-lg font-semibold">Guided Reading</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-generated stories built around your recently studied words. Choose a length and topic,
                then read with tap-to-define support.
              </p>
              <Button onClick={onStartReading} className="w-full" size="lg">
                <BookOpen className="w-4 h-4 mr-2" />
                Open Guided Reading
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Stack info */}
        <div className="w-[88%] sm:w-[85%] max-w-md flex-shrink-0 snap-center">
          <Card className="h-full border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Stack Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stack.cards.length}</div>
                  <div className="text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{learnedCards}</div>
                  <div className="text-muted-foreground">Learned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{newCards}</div>
                  <div className="text-muted-foreground">New</div>
                </div>
              </div>

              {dueToday > 0 && (
                <div className="text-sm text-muted-foreground font-medium text-center">
                  {dueToday} card{dueToday !== 1 ? "s" : ""} due for review today
                </div>
              )}

              <div className="pt-2 border-t">
                <div className="flex gap-1 mb-3">
                  <Button
                    size="sm"
                    variant={statsTab === "today" ? "default" : "ghost"}
                    className="flex-1 h-7 text-xs"
                    onClick={() => setStatsTab("today")}
                  >
                    Today
                  </Button>
                  <Button
                    size="sm"
                    variant={statsTab === "total" ? "default" : "ghost"}
                    className="flex-1 h-7 text-xs"
                    onClick={() => setStatsTab("total")}
                  >
                    All Time
                  </Button>
                </div>

                {statsTab === "today" ? (
                  <div className="space-y-1 text-sm">
                    <div>Words studied: {stack.todayStats.wordsStudied}</div>
                    <div>Time spent: {stack.todayStats.timeSpent} minutes</div>
                    {stack.todayStats.accuracy > 0 && <div>Accuracy: {stack.todayStats.accuracy}%</div>}
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <div>Words studied: {stack.allTimeStats.wordsStudied}</div>
                    <div>Time spent: {stack.allTimeStats.timeSpent} minutes</div>
                    <div>Sessions: {stack.allTimeStats.sessionsCount}</div>
                  </div>
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setShowStackSettings(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Edit Stack
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <StackSettingsDialog
        open={showStackSettings}
        onOpenChange={setShowStackSettings}
        stack={stack}
        onUpdateStack={onUpdateStack}
      />
    </div>
  )
}
