"use client"

import { useEffect, useState } from "react"
import type { SessionPhase } from "../hooks/use-study-session"

interface SessionHudProps {
  stackName: string
  phase: SessionPhase
  shortTermCount: number
  endOfDayCount: number
  progress: number        // 0–1 (used for word goal)
  totalCards: number      // word goal: target; time goal: planned cards
  cardsExitedLoop: number // cards that left the loop
  goalType: "time" | "words"
  goalMinutes: number     // only used when goalType === "time"
  sessionStartTime: number
  onJumpToShortTerm?: () => void
  onJumpToEndOfDay?: () => void
}

const PHASE_LABELS: Record<SessionPhase, string> = {
  loop: "Loop",
  "short-term": "Short-term Review",
  "end-of-day": "End-of-Day Review",
  complete: "Complete",
}

const PHASE_COLORS: Record<SessionPhase, string> = {
  loop: "bg-primary",
  "short-term": "bg-primary/80",
  "end-of-day": "bg-primary/50",
  complete: "bg-primary/50",
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function SessionHud({
  stackName,
  phase,
  shortTermCount,
  endOfDayCount,
  progress,
  totalCards,
  cardsExitedLoop,
  goalType,
  goalMinutes,
  sessionStartTime,
  onJumpToShortTerm,
  onJumpToEndOfDay,
}: SessionHudProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (goalType !== "time") return
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [goalType, sessionStartTime])

  const pct = Math.round(progress * 100)
  const totalSeconds = goalMinutes * 60
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)

  return (
    <>
      {/* Review counters */}
      <div className="fixed bottom-24 right-3 z-10 flex flex-row gap-2 sm:bottom-auto sm:right-4 sm:top-1/2 sm:-translate-y-1/2 sm:flex-col sm:gap-3">
        <div
          className={`flex h-12 w-12 flex-col items-center justify-center rounded-sm border border-border bg-card shadow-sm transition-transform sm:h-14 sm:w-14 ${onJumpToEndOfDay ? "cursor-pointer hover:scale-110 active:scale-95" : ""}`}
          onClick={onJumpToEndOfDay}
          title={onJumpToEndOfDay ? "Jump to End-of-Day review" : undefined}
        >
          <div className="text-base font-bold text-foreground sm:text-xl">{endOfDayCount}</div>
          <div className="text-[9px] text-muted-foreground text-center leading-tight">End of<br/>Day</div>
        </div>
        <div
          className={`flex h-12 w-12 flex-col items-center justify-center rounded-sm border border-border bg-card shadow-sm transition-transform sm:h-14 sm:w-14 ${onJumpToShortTerm ? "cursor-pointer hover:scale-110 active:scale-95" : ""}`}
          onClick={onJumpToShortTerm}
          title={onJumpToShortTerm ? "Jump to Short-Term review" : undefined}
        >
          <div className="text-base font-bold text-foreground sm:text-xl">{shortTermCount}</div>
          <div className="text-[9px] text-muted-foreground text-center leading-tight">Short<br/>Term</div>
        </div>
      </div>

      {/* Bottom phase bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background px-3 py-3 shadow-lg sm:px-4">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="max-w-[34%] truncate text-xs font-medium text-muted-foreground sm:text-sm">{stackName}</span>
            <span className={`inline-block px-2 py-0.5 rounded-sm text-xs text-primary-foreground ${PHASE_COLORS[phase]}`}>
              {PHASE_LABELS[phase]}
            </span>
            <span className="text-right text-[11px] text-muted-foreground sm:text-xs">
              {goalType === "time" ? (
                <span className={remainingSeconds < 60 ? "text-destructive font-medium" : ""}>
                  {formatTime(remainingSeconds)} left
                </span>
              ) : (
                `${cardsExitedLoop} / ${totalCards} words`
              )}
            </span>
          </div>

          {goalType === "words" ? (
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${PHASE_COLORS[phase]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : (
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${remainingSeconds < 60 ? "bg-destructive" : PHASE_COLORS[phase]}`}
                style={{ width: `${Math.round((elapsedSeconds / totalSeconds) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
