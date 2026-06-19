import { useEffect, useState } from "react"
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import AppPressable from "./AppPressable"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { GlobalSettings } from "../types"
import { colors } from "../theme/colors"

interface GlobalSettingsModalProps {
  visible: boolean
  settings: GlobalSettings
  onClose: () => void
  onSave: (settings: GlobalSettings) => void
  userEmail?: string | null
  onSignOut?: () => void
  syncing?: boolean
}

export default function GlobalSettingsModal({
  visible,
  settings,
  onClose,
  onSave,
  userEmail,
  onSignOut,
  syncing,
}: GlobalSettingsModalProps) {
  const insets = useSafeAreaInsets()
  const [local, setLocal] = useState(settings)

  useEffect(() => {
    if (visible) setLocal(settings)
  }, [visible, settings])

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.overlay}>
          <AppPressable style={StyleSheet.absoluteFill} onPress={onClose} feedback={false} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text style={styles.title}>Global Settings</Text>

            {userEmail && onSignOut && (
              <View style={styles.accountSection}>
                <Text style={styles.label}>Account</Text>
                <Text style={styles.accountEmail} numberOfLines={1}>
                  {userEmail}
                  {syncing ? " · saving…" : " · synced"}
                </Text>
                <AppPressable style={styles.signOutBtn} onPress={onSignOut}>
                  <Text style={styles.signOutText}>Sign out</Text>
                </AppPressable>
              </View>
            )}

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
              onChangeText={(v) => setLocal((prev) => ({ ...prev, defaultTimeGoal: Math.max(1, parseInt(v, 10) || 1) }))}
            />

            <Text style={styles.label}>Default Words Goal</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(local.defaultWordsGoal)}
              onChangeText={(v) => setLocal((prev) => ({ ...prev, defaultWordsGoal: Math.max(1, parseInt(v, 10) || 1) }))}
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

            <View style={styles.actions}>
              <AppPressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </AppPressable>
              <AppPressable
                style={styles.saveBtn}
                onPress={() => {
                  onSave(local)
                  onClose()
                }}
              >
                <Text style={styles.saveText}>Save Settings</Text>
              </AppPressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 6 },
  accountSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 4,
  },
  accountEmail: { fontSize: 14, color: colors.foreground },
  signOutBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  signOutText: { fontSize: 14, fontWeight: "600", color: colors.destructive },
  label: { fontSize: 14, color: colors.muted, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.foreground,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.muted },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { color: colors.foreground, flex: 1 },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  priorityBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  priorityText: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
  priorityTextActive: { color: colors.primaryForeground, fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { color: colors.foreground, fontWeight: "600" },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveText: { color: colors.primaryForeground, fontWeight: "700" },
})
