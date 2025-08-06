"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Settings, Play, FileText } from "lucide-react"
import type { Stack, StudyGoal, GlobalSettings } from "../types"
import StackSettingsDialog from "./stack-settings-dialog"

interface StackGoalPageProps {
  stack: Stack
  onBack: () => void
  onUpdateStack: (stack: Stack) => void
  globalSettings: GlobalSettings
}

export default function StackGoalPage({ stack, onBack, onUpdateStack, globalSettings }: StackGoalPageProps) {
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

  const handleStartStudy = () => {
    const goal: StudyGoal = {
      type: goalType,
      target: goalTarget,
      rememberSetting,
    }

    if (rememberSetting) {
      onUpdateStack({
        ...stack,
        savedGoal: goal,
      })
    }

    // TODO: Navigate to study session with this goal
    console.log("Starting study with goal:", goal)
  }

  const handleTestReview = () => {
    const goal: StudyGoal = {
      type: goalType,
      target: goalTarget,
      rememberSetting,
    }

    if (rememberSetting) {
      onUpdateStack({
        ...stack,
        savedGoal: goal,
      })
    }

    // TODO: Navigate to test review session with this goal
    console.log("Starting test review with goal:", goal)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Stacks
        </Button>
        <h2 className="text-2xl font-semibold">{stack.name}</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Today's Learning Goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <Label htmlFor="target">{goalType === "time" ? "Minutes to study" : "Number of words to learn"}</Label>
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

            <div className="flex gap-2">
              <Button onClick={handleStartStudy} className="flex-1" size="lg">
                <Play className="w-4 h-4 mr-2" />
                Start Studying
              </Button>
              <Button onClick={handleTestReview} variant="outline" className="flex-1" size="lg">
                <FileText className="w-4 h-4 mr-2" />
                Test Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stack Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">Total Cards</div>
                <div className="text-2xl font-bold">{stack.cards.length}</div>
              </div>
              <div>
                <div className="font-medium">Mastered</div>
                <div className="text-2xl font-bold text-green-600">
                  {stack.cards.filter((card) => card.mastered).length}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="font-medium mb-2">Today's Progress</div>
              <div className="space-y-1 text-sm">
                <div>Words studied: {stack.todayStats.wordsStudied}</div>
                <div>Time spent: {stack.todayStats.timeSpent} minutes</div>
                {stack.todayStats.accuracy > 0 && <div>Accuracy: {stack.todayStats.accuracy}%</div>}
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setShowStackSettings(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Edit Stack
            </Button>
          </CardContent>
        </Card>
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
