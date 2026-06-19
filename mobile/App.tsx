import { useCallback, useMemo, useState, type ReactNode } from "react"
import { ActivityIndicator, Alert, View, StyleSheet } from "react-native"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import type { Stack, StudyGoal, TestMode } from "./src/types"
import { DEFAULT_SETTINGS } from "./src/lib/defaults"
import { migrateCard } from "./src/lib/spaced-repetition"
import { dedupeCardsById } from "./src/lib/card-utils"
import { useAuth } from "./src/hooks/use-auth"
import { useUserData } from "./src/hooks/use-user-data"
import { useDueNotifications } from "./src/hooks/use-due-notifications"
import StacksScreen from "./src/components/StacksScreen"
import StackDetailScreen, {
  STACK_DETAIL_EDIT_PAGE,
  STACK_DETAIL_INFO_PAGE,
} from "./src/components/StackDetailScreen"
import StudySession from "./src/components/StudySession"
import TestSession from "./src/components/TestSession"
import GuidedReadingScreen from "./src/components/GuidedReadingScreen"
import ReadingHubScreen from "./src/components/ReadingHubScreen"
import SettingsScreen from "./src/components/SettingsScreen"
import BottomTabBar, { type MainTab } from "./src/components/BottomTabBar"
import SignInScreen from "./src/components/SignInScreen"
import { mergeTestSessionIntoStack, saveKnowledgeCheckProgress } from "./src/lib/stack-stats"
import { colors } from "./src/theme/colors"

type StackScreen =
  | { type: "detail"; stackId: string; initialPage?: number; sessionSummary?: "study" | "test" }
  | { type: "study"; stackId: string; goal: StudyGoal }
  | { type: "test"; stackId: string; mode: TestMode }
  | { type: "reading"; stackId: string; fromTab?: MainTab }

function AppRoot({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {children}
    </SafeAreaProvider>
  )
}

export default function App() {
  const { user, loading: authLoading, signOut, deleteAccount, supabaseEnabled } = useAuth()
  const {
    stacks,
    setStacks,
    globalSettings,
    setGlobalSettings,
    dataLoading,
    syncing,
  } = useUserData(user, authLoading)
  const [mainTab, setMainTab] = useState<MainTab>("home")
  const [stackScreen, setStackScreen] = useState<StackScreen | null>(null)
  const [guestMode, setGuestMode] = useState(false)

  const handleSignOut = async () => {
    setGuestMode(true)
    setMainTab("settings")
    setStackScreen(null)
    await signOut()
  }

  const handleDeleteAccount = async () => {
    const result = await deleteAccount()
    if (result.error) {
      Alert.alert("Could not delete account", result.error)
      return
    }

    setGuestMode(true)
    setMainTab("settings")
    setStackScreen(null)
  }

  const handleTabChange = (tab: MainTab) => {
    setMainTab(tab)
    setStackScreen(null)
  }

  const migratedStacks = useMemo(
    () =>
      stacks.map((stack) => ({
        ...stack,
        allTimeStats: stack.allTimeStats ?? { wordsStudied: 0, timeSpent: 0, sessionsCount: 0 },
        todayTestStats: stack.todayTestStats,
        allTimeTestStats: stack.allTimeTestStats,
        cards: dedupeCardsById(stack.cards.map(migrateCard)),
      })),
    [stacks],
  )

  const mergedSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...globalSettings }),
    [globalSettings],
  )

  useDueNotifications(migratedStacks, mergedSettings)

  const selectedStack = stackScreen
    ? migratedStacks.find((s) => s.id === stackScreen.stackId)
    : undefined

  const updateStack = useCallback((updated: Stack) => {
    setStacks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }, [setStacks])

  const addStack = useCallback((stack: Stack) => {
    setStacks((prev) => [...prev, stack])
  }, [setStacks])

  const openReading = useCallback((stackId: string, fromTab: MainTab = mainTab) => {
    setStackScreen({ type: "reading", stackId, fromTab })
  }, [mainTab])

  if (dataLoading || authLoading) {
    return (
      <AppRoot>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppRoot>
    )
  }

  if (supabaseEnabled && !user && !guestMode) {
    return (
      <AppRoot>
        <SignInScreen
          onSignedIn={() => {
            setGuestMode(false)
            setMainTab("home")
            setStackScreen(null)
          }}
          onContinueWithoutAccount={() => setGuestMode(true)}
        />
      </AppRoot>
    )
  }

  if (stackScreen?.type === "test" && selectedStack) {
    return (
      <AppRoot>
        <TestSession
          stack={selectedStack}
          mode={stackScreen.mode}
          onComplete={(partial) => {
            const updated = mergeTestSessionIntoStack(partial, partial.lastTestSession!)
            updateStack(updated)
            setStackScreen({
              type: "detail",
              stackId: updated.id,
              initialPage: STACK_DETAIL_INFO_PAGE,
              sessionSummary: "test",
            })
          }}
          onExit={(progress) => {
            if (progress) {
              updateStack(
                saveKnowledgeCheckProgress(selectedStack, progress.seenCardIds, progress.cards),
              )
            }
            setStackScreen({ type: "detail", stackId: stackScreen.stackId })
          }}
        />
      </AppRoot>
    )
  }

  if (stackScreen?.type === "study" && selectedStack) {
    return (
      <AppRoot>
        <StudySession
          stack={selectedStack}
          goal={stackScreen.goal}
          globalSettings={mergedSettings}
          onComplete={(updated) => {
            updateStack(updated)
            setStackScreen({
              type: "detail",
              stackId: updated.id,
              initialPage: STACK_DETAIL_INFO_PAGE,
              sessionSummary: "study",
            })
          }}
          onExit={() => setStackScreen({ type: "detail", stackId: stackScreen.stackId })}
        />
      </AppRoot>
    )
  }

  if (stackScreen?.type === "reading" && selectedStack) {
    const returnTab = stackScreen.fromTab ?? "reading"
    return (
      <AppRoot>
        <GuidedReadingScreen
          stack={selectedStack}
          onBack={() => {
            if (returnTab === "home") {
              setStackScreen({ type: "detail", stackId: selectedStack.id })
            } else {
              setStackScreen(null)
              setMainTab("reading")
            }
          }}
          onUpdateStack={updateStack}
        />
      </AppRoot>
    )
  }

  if (stackScreen?.type === "detail" && selectedStack) {
    return (
      <AppRoot>
        <StackDetailScreen
          stack={selectedStack}
          globalSettings={mergedSettings}
          initialPage={stackScreen.initialPage}
          sessionSummary={stackScreen.sessionSummary}
          onBack={() => setStackScreen(null)}
          onStartStudy={(goal) =>
            setStackScreen({ type: "study", stackId: selectedStack.id, goal })
          }
          onStartTest={(mode) =>
            setStackScreen({ type: "test", stackId: selectedStack.id, mode })
          }
          onUpdateStack={updateStack}
          onDeleteStack={() => {
            setStacks((prev) => prev.filter((s) => s.id !== selectedStack.id))
            setStackScreen(null)
          }}
        />
      </AppRoot>
    )
  }

  return (
    <AppRoot>
      <View style={styles.shell}>
        <View style={styles.content}>
          <View style={[styles.tabPane, mainTab !== "home" && styles.tabPaneHidden]}>
            <StacksScreen
              stacks={migratedStacks}
              onSelectStack={(stack) => setStackScreen({ type: "detail", stackId: stack.id })}
              onCreateStack={(stack) => {
                addStack(stack)
                setStackScreen({
                  type: "detail",
                  stackId: stack.id,
                  initialPage: STACK_DETAIL_EDIT_PAGE,
                })
              }}
            />
          </View>
          <View style={[styles.tabPane, mainTab !== "reading" && styles.tabPaneHidden]}>
            <ReadingHubScreen
              stacks={migratedStacks}
              onSelectStack={(stack) => openReading(stack.id, "reading")}
            />
          </View>
          <View style={[styles.tabPane, mainTab !== "settings" && styles.tabPaneHidden]}>
            <SettingsScreen
              settings={mergedSettings}
              onSave={setGlobalSettings}
              supabaseEnabled={supabaseEnabled}
              userEmail={user?.email}
              onSignOut={handleSignOut}
              onDeleteAccount={user ? handleDeleteAccount : undefined}
              syncing={syncing}
            />
          </View>
        </View>
        <BottomTabBar active={mainTab} onChange={handleTabChange} />
      </View>
    </AppRoot>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  tabPane: {
    ...StyleSheet.absoluteFillObject,
  },
  tabPaneHidden: {
    display: "none",
  },
})
