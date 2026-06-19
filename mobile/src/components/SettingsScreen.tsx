import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import AppPressable from "./AppPressable"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import type { GlobalSettings } from "../types"
import { signInWithGoogle } from "../lib/google-auth"
import { requestNotificationPermissions } from "../lib/notifications"
import { colors } from "../theme/colors"
import { TAB_BAR_HEIGHT } from "./BottomTabBar"

interface SettingsScreenProps {
  settings: GlobalSettings
  onSave: (settings: GlobalSettings) => void
  supabaseEnabled?: boolean
  userEmail?: string | null
  onSignOut?: () => void | Promise<void>
  onDeleteAccount?: () => void | Promise<void>
  syncing?: boolean
}

export default function SettingsScreen({
  settings,
  onSave,
  supabaseEnabled,
  userEmail,
  onSignOut,
  onDeleteAccount,
  syncing,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets()
  const [local, setLocal] = useState(settings)
  const [signInLoading, setSignInLoading] = useState(false)
  const [accountActionLoading, setAccountActionLoading] = useState(false)
  const isSignedIn = !!userEmail

  useEffect(() => {
    setLocal(settings)
  }, [settings])

  const handleSave = () => {
    onSave(local)
  }

  const handleNotificationsToggle = async () => {
    if (local.notificationsEnabled) {
      setLocal((prev) => ({ ...prev, notificationsEnabled: false }))
      return
    }

    const granted = await requestNotificationPermissions()
    if (granted) {
      setLocal((prev) => ({ ...prev, notificationsEnabled: true }))
      return
    }

    Alert.alert(
      "Notifications blocked",
      "Enable notifications in your device settings to receive daily due-card reminders.",
    )
  }

  const notificationsEnabled = local.notificationsEnabled === true

  const handleSignIn = async () => {
    setSignInLoading(true)
    const result = await signInWithGoogle()
    setSignInLoading(false)

    if (result.error) {
      Alert.alert("Sign in failed", result.error)
      return
    }
    if (result.cancelled) return
  }

  const handleSignOut = () => {
    if (!onSignOut) return

    Alert.alert("Sign out?", "Your stacks on this device will stay here. Sign in again to sync.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setAccountActionLoading(true)
          try {
            await onSignOut()
          } finally {
            setAccountActionLoading(false)
          }
        },
      },
    ])
  }

  const handleDeleteAccount = () => {
    if (!onDeleteAccount) return

    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and synced stacks from our servers. Stacks saved on this device will remain until you clear app data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setAccountActionLoading(true)
            try {
              await onDeleteAccount()
            } finally {
              setAccountActionLoading(false)
            }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>Settings</Text>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <AppPressable style={styles.checkRow} onPress={handleNotificationsToggle}>
              <View style={[styles.checkbox, notificationsEnabled && styles.checkboxOn]} />
              <View style={styles.checkCopy}>
                <Text style={styles.checkLabel}>Daily due-card reminders</Text>
                <Text style={styles.checkHint}>
                  Get a daily notification at 9:00 AM listing cards due in each stack.
                </Text>
              </View>
            </AppPressable>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Study goals</Text>

            <AppPressable
              style={styles.checkRow}
              onPress={() => setLocal((prev) => ({ ...prev, useGlobalGoals: !prev.useGlobalGoals }))}
            >
              <View style={[styles.checkbox, local.useGlobalGoals && styles.checkboxOn]} />
              <Text style={styles.checkLabel}>Use global default goals for all stacks</Text>
            </AppPressable>

            <Text style={styles.label}>Default Time Goal (minutes)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(local.defaultTimeGoal)}
              onChangeText={(v) =>
                setLocal((prev) => ({ ...prev, defaultTimeGoal: Math.max(1, parseInt(v, 10) || 1) }))
              }
            />

            <Text style={styles.label}>Default Words Goal</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(local.defaultWordsGoal)}
              onChangeText={(v) =>
                setLocal((prev) => ({ ...prev, defaultWordsGoal: Math.max(1, parseInt(v, 10) || 1) }))
              }
            />

            <Text style={styles.label}>Study Priority</Text>
            <View style={styles.priorityRow}>
              <AppPressable
                style={[styles.priorityBtn, local.priority === "new-words" && styles.priorityBtnActive]}
                onPress={() => setLocal((prev) => ({ ...prev, priority: "new-words" }))}
              >
                <Text style={local.priority === "new-words" ? styles.priorityTextActive : styles.priorityText}>
                  New words first
                </Text>
              </AppPressable>
              <AppPressable
                style={[styles.priorityBtn, local.priority === "solidify" && styles.priorityBtnActive]}
                onPress={() => setLocal((prev) => ({ ...prev, priority: "solidify" }))}
              >
                <Text style={local.priority === "solidify" ? styles.priorityTextActive : styles.priorityText}>
                  Review first
                </Text>
              </AppPressable>
            </View>
          </View>

          {supabaseEnabled && (
            <View style={styles.accountSection}>
              <Text style={styles.sectionTitle}>Account</Text>
              {isSignedIn ? (
                <>
                  <Text style={styles.accountEmail} numberOfLines={1}>
                    {userEmail}
                    {syncing ? " · saving…" : " · synced"}
                  </Text>
                  <Text style={styles.accountHint}>
                    Your stacks sync across devices while you are signed in.
                  </Text>
                  <AppPressable
                    style={styles.accountActionBtn}
                    onPress={handleSignOut}
                    disabled={accountActionLoading}
                  >
                    {accountActionLoading ? (
                      <ActivityIndicator color={colors.destructive} size="small" />
                    ) : (
                      <Text style={styles.signOutText}>Sign out</Text>
                    )}
                  </AppPressable>
                  {onDeleteAccount && (
                    <AppPressable
                      style={styles.accountActionBtn}
                      onPress={handleDeleteAccount}
                      disabled={accountActionLoading}
                    >
                      <Text style={styles.deleteAccountText}>Delete account</Text>
                    </AppPressable>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.accountHint}>
                    Sign in to sync your stacks across devices and keep your progress backed up.
                  </Text>
                  <AppPressable
                    style={[styles.signInBtn, signInLoading && styles.disabled]}
                    onPress={handleSignIn}
                    disabled={signInLoading}
                  >
                    {signInLoading ? (
                      <ActivityIndicator color={colors.foreground} size="small" />
                    ) : (
                      <Text style={styles.signInBtnText}>Sign in with Google</Text>
                    )}
                  </AppPressable>
                </>
              )}
            </View>
          )}

          <AppPressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>Save Settings</Text>
          </AppPressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 20, gap: 12 },
  heading: { fontSize: 26, fontWeight: "700", color: colors.foreground, marginBottom: 8 },
  sectionBlock: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  accountSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 4,
  },
  accountEmail: { fontSize: 14, color: colors.foreground, fontWeight: "600" },
  accountHint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  accountActionBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
    minHeight: 32,
    justifyContent: "center",
  },
  signOutText: { fontSize: 14, fontWeight: "600", color: colors.destructive },
  deleteAccountText: { fontSize: 14, fontWeight: "600", color: colors.destructive },
  signInBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    alignItems: "center",
    minHeight: 46,
    justifyContent: "center",
  },
  signInBtnText: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  disabled: { opacity: 0.6 },
  label: { fontSize: 14, color: colors.muted, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.muted, marginTop: 2 },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkCopy: { flex: 1, gap: 4 },
  checkLabel: { color: colors.foreground },
  checkHint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  priorityBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  priorityText: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
  priorityTextActive: { color: colors.primaryForeground, fontSize: 13, fontWeight: "600" },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 16 },
})
