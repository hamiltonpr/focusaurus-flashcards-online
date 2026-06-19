import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import type { GlobalSettings, Stack } from "../types"
import { countDueCards } from "./spaced-repetition"

const DUE_NOTIFICATION_ID = "due-cards-daily"
const ANDROID_CHANNEL_ID = "due-cards"
const DEFAULT_HOUR = 9
const DEFAULT_MINUTE = 0

export function isStackNotificationsEnabled(stack: Stack): boolean {
  return stack.stackSettings?.notificationsEnabled !== false
}

function formatDueNotificationBody(
  entries: { name: string; count: number }[],
): string {
  if (entries.length === 1) {
    const { name, count } = entries[0]
    const label = count === 1 ? "card" : "cards"
    return `${name}: ${count} ${label} due for review`
  }

  return entries
    .map(({ name, count }) => {
      const label = count === 1 ? "card" : "cards"
      return `• ${name}: ${count} ${label}`
    })
    .join("\n")
}

function getDueStacks(stacks: Stack[]): { name: string; count: number }[] {
  return stacks
    .filter(isStackNotificationsEnabled)
    .map((stack) => ({ name: stack.name, count: countDueCards(stack.cards) }))
    .filter((entry) => entry.count > 0)
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Due card reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  if (existingStatus === "granted") return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === "granted"
}

export async function cancelDueNotifications(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DUE_NOTIFICATION_ID).catch(() => {})
}

export async function rescheduleDueNotifications(
  stacks: Stack[],
  settings: GlobalSettings,
): Promise<void> {
  await cancelDueNotifications()

  if (!settings.notificationsEnabled) return

  const granted = await requestNotificationPermissions()
  if (!granted) return

  const dueStacks = getDueStacks(stacks)
  if (dueStacks.length === 0) return

  const body = formatDueNotificationBody(dueStacks)
  const title =
    dueStacks.length === 1
      ? "Cards due for review"
      : `${dueStacks.length} stacks have cards due`

  await Notifications.scheduleNotificationAsync({
    identifier: DUE_NOTIFICATION_ID,
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: DEFAULT_HOUR,
      minute: DEFAULT_MINUTE,
      channelId: ANDROID_CHANNEL_ID,
    },
  })
}
