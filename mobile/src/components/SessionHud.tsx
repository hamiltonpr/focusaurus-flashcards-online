import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import AppPressable from "./AppPressable"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { SessionPhase } from "../hooks/use-study-session"
import { colors, radius } from "../theme/colors"

interface SessionHudProps {
  phase: SessionPhase
  shortTermCount: number
  endOfDayCount: number
  progress: number
  totalCards: number
  cardsExitedLoop: number
  goalType: "time" | "words"
  goalMinutes: number
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
  loop: colors.phaseLoop,
  "short-term": colors.phaseShortTerm,
  "end-of-day": colors.phaseEndOfDay,
  complete: colors.phaseEndOfDay,
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function SessionHud({
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
  const insets = useSafeAreaInsets()

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
  const barPct =
    goalType === "words"
      ? pct
      : totalSeconds > 0
        ? Math.round((elapsedSeconds / totalSeconds) * 100)
        : 0

  const shortTermActive = phase === "short-term"
  const endOfDayActive = phase === "end-of-day"

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.queueRow}>
        <AppPressable
          style={[
            styles.queueBtn,
            shortTermActive && styles.queueBtnActive,
            !onJumpToShortTerm && !shortTermActive && styles.queueBtnDisabled,
          ]}
          onPress={onJumpToShortTerm}
          disabled={!onJumpToShortTerm}
        >
          <Text style={[styles.queueCount, shortTermActive && styles.queueCountActive]}>
            {shortTermCount}
          </Text>
          <Text style={[styles.queueLabel, shortTermActive && styles.queueLabelActive]}>
            Short Term
          </Text>
        </AppPressable>

        <AppPressable
          style={[
            styles.queueBtn,
            endOfDayActive && styles.queueBtnActiveEnd,
            !onJumpToEndOfDay && !endOfDayActive && styles.queueBtnDisabled,
          ]}
          onPress={onJumpToEndOfDay}
          disabled={!onJumpToEndOfDay}
        >
          <Text style={[styles.queueCount, endOfDayActive && styles.queueCountActive]}>
            {endOfDayCount}
          </Text>
          <Text style={[styles.queueLabel, endOfDayActive && styles.queueLabelActive]}>
            End of Day
          </Text>
        </AppPressable>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.phaseBadge, { backgroundColor: PHASE_COLORS[phase] }]}>
          <Text style={styles.phaseText}>{PHASE_LABELS[phase]}</Text>
        </View>
        <Text style={styles.goalText}>
          {goalType === "time" ? (
            <Text style={remainingSeconds < 60 ? styles.urgent : undefined}>
              {formatTime(remainingSeconds)} left
            </Text>
          ) : (
            `${cardsExitedLoop} / ${totalCards} words`
          )}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(barPct, 100)}%`,
              backgroundColor:
                goalType === "time" && remainingSeconds < 60 ? colors.destructive : PHASE_COLORS[phase],
            },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  queueRow: {
    flexDirection: "row",
    gap: 10,
  },
  queueBtn: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.phaseShortTerm,
    backgroundColor: colors.tealBg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  queueBtnActive: {
    backgroundColor: colors.phaseShortTerm,
    borderColor: colors.phaseShortTerm,
  },
  queueBtnActiveEnd: {
    backgroundColor: colors.phaseEndOfDay,
    borderColor: colors.phaseEndOfDay,
  },
  queueBtnDisabled: {
    opacity: 0.45,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
  },
  queueCount: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.foreground,
  },
  queueCountActive: {
    color: colors.primaryForeground,
  },
  queueLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    color: colors.muted,
    marginTop: 2,
  },
  queueLabelActive: {
    color: colors.primaryForeground,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  phaseText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: "600",
  },
  goalText: {
    fontSize: 13,
    color: colors.muted,
  },
  urgent: {
    color: colors.destructive,
    fontWeight: "600",
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.progressTrack,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
})
