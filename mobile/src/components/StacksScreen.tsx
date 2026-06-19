import { useEffect, useState } from "react"
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import AppPressable from "./AppPressable"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import type { Stack } from "../types"
import { colors, radius } from "../theme/colors"

interface CreateStackModalProps {
  visible: boolean
  onClose: () => void
  onCreate: (stack: Stack) => void
}

export function CreateStackModal({ visible, onClose, onCreate }: CreateStackModalProps) {
  const [name, setName] = useState("")
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (visible) setName("")
  }, [visible])

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate({
      id: Date.now().toString(),
      name: trimmed,
      cards: [],
      todayStats: { wordsStudied: 0, timeSpent: 0, accuracy: 0 },
      allTimeStats: { wordsStudied: 0, timeSpent: 0, sessionsCount: 0 },
    })
    setName("")
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.overlay}>
          <AppPressable style={StyleSheet.absoluteFill} onPress={onClose} feedback={false} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text style={styles.title}>Create New Stack</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Spanish Vocabulary"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <View style={styles.actions}>
              <AppPressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </AppPressable>
              <AppPressable
                style={[styles.createBtn, !name.trim() && styles.disabled]}
                onPress={handleCreate}
                disabled={!name.trim()}
              >
                <Text style={styles.createText}>Create Stack</Text>
              </AppPressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

interface StacksScreenProps {
  stacks: Stack[]
  onSelectStack: (stack: Stack) => void
  onCreateStack: (stack: Stack) => void
}

export default function StacksScreen({
  stacks,
  onSelectStack,
  onCreateStack,
}: StacksScreenProps) {
  const [showCreate, setShowCreate] = useState(false)

  const formatLastStudied = (dateString?: string) => {
    if (!dateString) return "Never studied"
    const today = new Date().toISOString().split("T")[0]
    if (dateString === today) return "Today"
    return new Date(dateString).toLocaleDateString()
  }

  const openCreate = () => setShowCreate(true)

  return (
    <>
      <CreateStackModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={onCreateStack}
      />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Image source={require("../../assets/icon.png")} style={styles.logo} />
            <Text style={styles.heading}>Focasaurus</Text>
          </View>
          <Text style={styles.subheading}>Your Stacks</Text>
        </View>

        <FlatList
          data={stacks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 72 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No stacks yet</Text>
              <Text style={styles.emptyText}>Create your first stack to start studying!</Text>
              <AppPressable style={styles.emptyBtn} onPress={openCreate}>
                <Text style={styles.emptyBtnText}>Create Stack</Text>
              </AppPressable>
            </View>
          }
          renderItem={({ item }) => (
            <AppPressable style={styles.card} onPress={() => onSelectStack(item)}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.cardMeta}>
                {item.cards.length} cards · Last studied: {formatLastStudied(item.lastStudied)}
              </Text>
              {item.todayStats.wordsStudied > 0 && (
                <Text style={styles.cardProgress}>
                  Today: {item.todayStats.wordsStudied} words · {item.todayStats.timeSpent} min
                </Text>
              )}
            </AppPressable>
          )}
        />

        <AppPressable style={styles.newBtn} onPress={openCreate}>
          <Text style={styles.newBtnText}>+ New Stack</Text>
        </AppPressable>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  logo: { width: 36, height: 36, borderRadius: 8 },
  heading: { fontSize: 26, fontWeight: "700", color: colors.foreground },
  subheading: { fontSize: 18, fontWeight: "600", marginTop: 12, color: colors.foreground },
  list: { padding: 16, paddingTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: "600", color: colors.foreground },
  cardMeta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  cardProgress: { fontSize: 12, color: colors.mutedLight, marginTop: 4 },
  empty: { alignItems: "center", padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.foreground },
  emptyText: { color: colors.muted, marginTop: 8, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  emptyBtnText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 16 },
  newBtn: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    zIndex: 10,
    elevation: 4,
  },
  newBtnText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 16 },
  modalRoot: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingTop: 20,
    gap: 16,
  },
  title: { fontSize: 18, fontWeight: "600", color: colors.foreground },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.foreground,
  },
  actions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelText: { fontSize: 16, fontWeight: "500", color: colors.foreground },
  createBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  createText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 16 },
  disabled: { opacity: 0.4 },
})
