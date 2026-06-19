import { memo, useCallback, useEffect, useMemo, useState } from "react"
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import AppPressable from "./AppPressable"
import { SafeAreaView } from "react-native-safe-area-context"
import type { Card, Stack, StackSettings } from "../types"
import { formatNextReviewLabel, isCardDueToday, markCardAsLearned } from "../lib/spaced-repetition"
import { dedupeCardsById, generateCardId } from "../lib/card-utils"
import { colors, radius } from "../theme/colors"
import ImportCsvModal from "./ImportCsvModal"

interface StackEditScreenProps {
  stack: Stack
  onUpdateStack: (stack: Stack) => void
  embedded?: boolean
  onBack?: () => void
  onSaveAndExit?: (stack: Stack) => void
  onDeleteStack?: () => void
}

const DEFAULT_STACK_SETTINGS: StackSettings = {
  loopSize: 4,
  shortTermSize: 5,
  wrongStreakLimit: 3,
}

const SESSION_SETTING_FIELDS = [
  {
    key: "loopSize" as const,
    title: "Cards in rotation",
    description:
      "How many flashcards you cycle through at once during a session. When you get one right, a new card takes its place.",
    min: 2,
    fallback: 4,
  },
  {
    key: "shortTermSize" as const,
    title: "Review batch size",
    description:
      "Cards you answer correctly wait in a short queue. When the queue reaches this size, you review that batch before continuing.",
    min: 1,
    fallback: 5,
  },
  {
    key: "wrongStreakLimit" as const,
    title: "Wrong-answer limit",
    description:
      "For words you've already learned, how many times in a row you can miss them before they're treated as new again.",
    min: 1,
    fallback: 3,
  },
] as const

interface CardRowProps {
  card: Card
  embedded: boolean
  isEditing: boolean
  editFront: string
  editBack: string
  onEditFront: (value: string) => void
  onEditBack: (value: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onMarkKnown: () => void
  onDelete: () => void
}

const CardRow = memo(function CardRow({
  card,
  embedded,
  isEditing,
  editFront,
  editBack,
  onEditFront,
  onEditBack,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onMarkKnown,
  onDelete,
}: CardRowProps) {
  const nextReviewLabel = formatNextReviewLabel(card.nextReviewDate)
  const isDue = Boolean(card.nextReviewDate && isCardDueToday(card))

  return (
    <View style={[styles.cardRow, embedded && styles.cardRowEmbedded]}>
      {isEditing ? (
        <>
          <Text style={styles.label}>Front</Text>
          <TextInput style={styles.input} value={editFront} onChangeText={onEditFront} />
          <Text style={styles.label}>Back</Text>
          <TextInput style={styles.input} value={editBack} onChangeText={onEditBack} />
          <View style={styles.cardActions}>
            <AppPressable style={styles.smallBtn} onPress={onSaveEdit}>
              <Text style={styles.smallBtnText}>Save</Text>
            </AppPressable>
            <AppPressable style={[styles.smallBtn, styles.smallBtnOutline]} onPress={onCancelEdit}>
              <Text style={styles.smallBtnOutlineText}>Cancel</Text>
            </AppPressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.cardTextBlock}>
            <Text style={styles.cardFront}>{card.front}</Text>
            <Text style={styles.cardBack}>{card.back}</Text>
            <View style={styles.cardMetaRow}>
              {card.cardType === 2 && (
                <View style={styles.learnedPill}>
                  <Text style={styles.learnedBadge}>Learned</Text>
                </View>
              )}
              {nextReviewLabel ? (
                <Text
                  style={[
                    styles.nextReviewText,
                    isDue && styles.nextReviewDue,
                    card.cardType === 2 && styles.nextReviewWithBadge,
                  ]}
                >
                  {nextReviewLabel}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.cardActions}>
            {card.cardType !== 2 && (
              <AppPressable style={styles.smallBtn} onPress={onMarkKnown}>
                <Text style={styles.smallBtnText}>Mark as learned</Text>
              </AppPressable>
            )}
            <AppPressable style={[styles.smallBtn, styles.smallBtnOutline]} onPress={onStartEdit}>
              <Text style={styles.smallBtnOutlineText}>Edit</Text>
            </AppPressable>
            <AppPressable style={[styles.smallBtn, styles.smallBtnDanger]} onPress={onDelete}>
              <Text style={styles.smallBtnDangerText}>Delete</Text>
            </AppPressable>
          </View>
        </>
      )}
    </View>
  )
})

export default function StackEditScreen({
  stack,
  onUpdateStack,
  embedded = false,
  onBack,
  onSaveAndExit,
  onDeleteStack,
}: StackEditScreenProps) {
  const [stackName, setStackName] = useState(stack.name)
  const [cards, setCards] = useState<Card[]>(() => dedupeCardsById(stack.cards))
  const [stackSettings, setStackSettings] = useState<StackSettings>(
    stack.stackSettings ?? DEFAULT_STACK_SETTINGS,
  )
  const [newFront, setNewFront] = useState("")
  const [newBack, setNewBack] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState("")
  const [editBack, setEditBack] = useState("")
  const [showImport, setShowImport] = useState(false)

  const buildStack = (
    overrides: Partial<{ name: string; cards: Card[]; stackSettings: StackSettings }> = {},
  ): Stack | null => {
    const name = (overrides.name ?? stackName).trim()
    if (!name) return null
    return {
      ...stack,
      name,
      cards: overrides.cards ?? cards,
      stackSettings: overrides.stackSettings ?? stackSettings,
    }
  }

  const persistStack = (
    overrides: Partial<{ name: string; cards: Card[]; stackSettings: StackSettings }> = {},
  ) => {
    const updated = buildStack(overrides)
    if (updated) onUpdateStack(updated)
  }

  useEffect(() => {
    if (cards.length < stack.cards.length) {
      persistStack({ cards })
    }
    // Clean duplicate card ids from storage once when opening the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddCard = useCallback(() => {
    const front = newFront.trim()
    const back = newBack.trim()
    if (!front || !back) return
    const newCard: Card = {
      id: generateCardId(),
      front,
      back,
      cardType: 1,
      interval: 0,
    }
    setCards((prev) => {
      const updatedCards = [...prev, newCard]
      persistStack({ cards: updatedCards })
      return updatedCards
    })
    setNewFront("")
    setNewBack("")
  }, [newFront, newBack])

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return
    setCards((prev) => {
      const updatedCards = prev.map((c) =>
        c.id === editingId ? { ...c, front: editFront.trim(), back: editBack.trim() } : c,
      )
      persistStack({ cards: updatedCards })
      return updatedCards
    })
    setEditingId(null)
    setEditFront("")
    setEditBack("")
  }, [editingId, editFront, editBack])

  const handleDeleteCard = useCallback((cardId: string) => {
    Alert.alert("Delete card", "Remove this card from the stack?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setCards((prev) => {
            const updatedCards = prev.filter((c) => c.id !== cardId)
            persistStack({ cards: updatedCards })
            return updatedCards
          })
        },
      },
    ])
  }, [])

  const handleMarkKnown = useCallback((cardId: string) => {
    Alert.alert(
      "Mark as learned?",
      "This skips study for this card and schedules it for long-term review later. Use this if you already know the word.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark as learned",
          onPress: () => {
            setCards((prev) => {
              const updatedCards = prev.map((c) =>
                c.id === cardId ? markCardAsLearned(c) : c,
              )
              persistStack({ cards: updatedCards })
              return updatedCards
            })
          },
        },
      ],
    )
  }, [])

  const handleImportCards = (imported: Card[]) => {
    const withFreshIds = imported.map((card) => ({ ...card, id: generateCardId() }))
    const updatedCards = dedupeCardsById([...cards, ...withFreshIds])
    setCards(updatedCards)
    persistStack({ cards: updatedCards })
  }

  const handleSave = () => {
    const updated = buildStack()
    if (!updated) {
      Alert.alert("Stack name required", "Please enter a name for this stack.")
      return
    }
    onUpdateStack(updated)
    if (onSaveAndExit) {
      onSaveAndExit(updated)
    }
  }

  const handleDeleteStack = () => {
    if (!onDeleteStack) return
    Alert.alert(
      "Delete stack",
      `Delete "${stackName.trim() || stack.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDeleteStack },
      ],
    )
  }

  const numSetting = (value: string, fallback: number, min: number) =>
    Math.max(min, parseInt(value, 10) || fallback)

  const stackNotificationsEnabled = stackSettings.notificationsEnabled !== false

  const toggleStackNotifications = () => {
    setStackSettings({
      ...stackSettings,
      notificationsEnabled: !stackNotificationsEnabled,
    })
  }

  const renderNotificationToggle = (embeddedStyle: boolean) => (
    <AppPressable
      style={embeddedStyle ? styles.notificationRowEmbedded : styles.notificationRowClassic}
      onPress={toggleStackNotifications}
    >
      <View style={[styles.notificationCheckbox, stackNotificationsEnabled && styles.notificationCheckboxOn]} />
      <View style={styles.notificationCopy}>
        <Text style={embeddedStyle ? styles.settingExplainTitle : styles.classicSettingTitle}>
          Daily due-card reminders
        </Text>
        <Text style={embeddedStyle ? styles.settingExplainBody : styles.classicSettingBody}>
          Include this stack in your daily notification when cards are due for review.
        </Text>
      </View>
    </AppPressable>
  )

  const startEditingCard = useCallback((card: Card) => {
    setEditingId(card.id)
    setEditFront(card.front)
    setEditBack(card.back)
  }, [])

  const cancelEditingCard = useCallback(() => {
    setEditingId(null)
    setEditFront("")
    setEditBack("")
  }, [])

  const renderCardItem = useCallback(
    ({ item: card }: { item: Card }) => (
      <CardRow
        card={card}
        embedded={embedded}
        isEditing={editingId === card.id}
        editFront={editFront}
        editBack={editBack}
        onEditFront={setEditFront}
        onEditBack={setEditBack}
        onStartEdit={() => startEditingCard(card)}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={cancelEditingCard}
        onMarkKnown={() => handleMarkKnown(card.id)}
        onDelete={() => handleDeleteCard(card.id)}
      />
    ),
    [
      embedded,
      editingId,
      editFront,
      editBack,
      startEditingCard,
      cancelEditingCard,
      handleSaveEdit,
      handleMarkKnown,
      handleDeleteCard,
    ],
  )

  const embeddedListHeader = useMemo(
    () => (
      <>
        <View style={styles.editHero}>
          <Text style={styles.editTitle}>Manage your stack</Text>
          <Text style={styles.editSubtitle}>cards & settings</Text>
          <Text style={styles.editMeta}>
            {cards.length} card{cards.length !== 1 ? "s" : ""} in this deck
          </Text>
        </View>

        <View style={styles.editBlock}>
          <Text style={styles.blockHeading}>Stack details</Text>
          <Text style={styles.fieldLabel}>Stack name</Text>
          <TextInput
            style={[styles.input, styles.inputEmbedded, styles.inputLast]}
            value={stackName}
            onChangeText={setStackName}
            placeholder="e.g. French Vocabulary"
          />
          {onDeleteStack && (
            <AppPressable style={styles.deleteStackBtn} onPress={handleDeleteStack}>
              <Text style={styles.deleteStackText}>Delete stack</Text>
            </AppPressable>
          )}
        </View>

        <View style={styles.editBlock}>
          <Text style={styles.blockHeading}>Session settings</Text>
          {renderNotificationToggle(true)}
          {SESSION_SETTING_FIELDS.map((field) => (
            <View key={field.key} style={styles.settingExplainRow}>
              <Text style={styles.settingExplainTitle}>{field.title}</Text>
              <Text style={styles.settingExplainBody}>{field.description}</Text>
              <TextInput
                style={styles.settingExplainInput}
                value={String(stackSettings[field.key])}
                onChangeText={(v) =>
                  setStackSettings({
                    ...stackSettings,
                    [field.key]: numSetting(v, field.fallback, field.min),
                  })
                }
                keyboardType="number-pad"
                textAlign="center"
              />
            </View>
          ))}
        </View>

        <View style={styles.editBlock}>
          <Text style={styles.blockHeading}>Add a card</Text>
          <Text style={styles.fieldLabel}>Front (foreign language)</Text>
          <TextInput
            style={styles.inputEmbedded}
            value={newFront}
            onChangeText={setNewFront}
            placeholder="e.g. Bonjour"
          />
          <Text style={styles.fieldLabel}>Back (English)</Text>
          <TextInput
            style={styles.inputEmbedded}
            value={newBack}
            onChangeText={setNewBack}
            placeholder="e.g. Hello"
          />
          <View style={styles.addActions}>
            <AppPressable
              style={[
                styles.primaryAction,
                styles.addActionPrimary,
                (!newFront.trim() || !newBack.trim()) && styles.disabled,
              ]}
              onPress={handleAddCard}
              disabled={!newFront.trim() || !newBack.trim()}
            >
              <Text style={styles.primaryActionText}>+ Add card</Text>
            </AppPressable>
            <AppPressable
              style={[styles.primaryAction, styles.addActionSecondary]}
              onPress={() => setShowImport(true)}
            >
              <Text style={styles.secondaryActionText}>Import CSV</Text>
            </AppPressable>
          </View>
        </View>

        <View style={styles.cardsListHeader}>
          <Text style={styles.blockHeading}>Cards ({cards.length})</Text>
        </View>
      </>
    ),
    [
      cards.length,
      stackName,
      stackSettings,
      newFront,
      newBack,
      onDeleteStack,
      handleDeleteStack,
      handleAddCard,
      stackNotificationsEnabled,
    ],
  )

  const classicListHeader = useMemo(
    () => (
      <>
        <View style={styles.section}>
          <Text style={styles.label}>Stack name</Text>
          <TextInput style={styles.input} value={stackName} onChangeText={setStackName} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session settings</Text>
          {renderNotificationToggle(false)}
          {SESSION_SETTING_FIELDS.map((field) => (
            <View key={field.key} style={styles.classicSettingBlock}>
              <Text style={styles.classicSettingTitle}>{field.title}</Text>
              <Text style={styles.classicSettingBody}>{field.description}</Text>
              <TextInput
                style={styles.input}
                value={String(stackSettings[field.key])}
                onChangeText={(v) =>
                  setStackSettings({
                    ...stackSettings,
                    [field.key]: numSetting(v, field.fallback, field.min),
                  })
                }
                keyboardType="number-pad"
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add card</Text>
          <Text style={styles.label}>Front (foreign language)</Text>
          <TextInput
            style={styles.input}
            value={newFront}
            onChangeText={setNewFront}
            placeholder="e.g. Bonjour"
          />
          <Text style={styles.label}>Back (English)</Text>
          <TextInput
            style={styles.input}
            value={newBack}
            onChangeText={setNewBack}
            placeholder="e.g. Hello"
          />
          <AppPressable
            style={[styles.secondaryBtn, (!newFront.trim() || !newBack.trim()) && styles.disabled]}
            onPress={handleAddCard}
            disabled={!newFront.trim() || !newBack.trim()}
          >
            <Text style={styles.secondaryBtnText}>+ Add card</Text>
          </AppPressable>
          <AppPressable style={styles.importBtn} onPress={() => setShowImport(true)}>
            <Text style={styles.importBtnText}>Import from CSV</Text>
          </AppPressable>
        </View>

        <Text style={styles.cardsHeading}>Cards ({cards.length})</Text>
      </>
    ),
    [cards.length, stackName, stackSettings, newFront, newBack, handleAddCard, stackNotificationsEnabled],
  )

  const emptyCardList = useMemo(
    () => (
      <View style={embedded ? styles.emptyState : undefined}>
        <Text style={styles.emptyCards}>No cards yet. Add your first one above.</Text>
      </View>
    ),
    [embedded],
  )

  const listProps = {
    data: cards,
    keyExtractor: (item: Card) => item.id,
    renderItem: renderCardItem,
    extraData: `${editingId}:${editFront}:${editBack}`,
    keyboardShouldPersistTaps: "handled" as const,
    showsVerticalScrollIndicator: false,
    initialNumToRender: 10,
    maxToRenderPerBatch: 8,
    windowSize: 7,
    removeClippedSubviews: Platform.OS === "android",
  }

  const embeddedBody = (
    <>
      <ImportCsvModal
        visible={showImport}
        mode="into-stack"
        onClose={() => setShowImport(false)}
        onImportCards={handleImportCards}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          {...listProps}
          ListHeaderComponent={embeddedListHeader}
          ListEmptyComponent={emptyCardList}
          contentContainerStyle={styles.embeddedScroll}
          nestedScrollEnabled
        />
      </KeyboardAvoidingView>
    </>
  )

  const classicBody = (
    <>
      <ImportCsvModal
        visible={showImport}
        mode="into-stack"
        onClose={() => setShowImport(false)}
        onImportCards={handleImportCards}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          {...listProps}
          ListHeaderComponent={classicListHeader}
          ListEmptyComponent={emptyCardList}
          contentContainerStyle={styles.content}
        />
      </KeyboardAvoidingView>
    </>
  )

  if (embedded) {
    return (
      <View style={styles.embedded}>
        {embeddedBody}
        <View style={styles.floatingSaveBar}>
          <AppPressable style={styles.floatingSaveBtn} onPress={handleSave}>
            <Text style={styles.floatingSaveText}>Save changes</Text>
          </AppPressable>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <AppPressable onPress={onBack} style={styles.headerSide}>
          <Text style={styles.backText}>Cancel</Text>
        </AppPressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Edit Stack
        </Text>
        <AppPressable onPress={handleSave} style={styles.headerSide}>
          <Text style={styles.saveText}>Save</Text>
        </AppPressable>
      </View>
      {classicBody}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  embedded: { flex: 1, backgroundColor: colors.card },
  embeddedScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 100,
    gap: 24,
  },
  editHero: {
    alignItems: "center",
  },
  editTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 28,
  },
  editSubtitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
    lineHeight: 28,
  },
  editMeta: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 10,
    textAlign: "center",
  },
  editBlock: {
    backgroundColor: colors.tealBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  blockHeading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    textAlign: "center",
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 6,
  },
  deleteStackBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.destructiveBg,
    alignItems: "center",
  },
  deleteStackText: {
    color: colors.destructive,
    fontWeight: "600",
    fontSize: 15,
  },
  settingExplainRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  notificationRowEmbedded: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  notificationRowClassic: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  notificationCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.muted,
    marginTop: 2,
  },
  notificationCheckboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  notificationCopy: {
    flex: 1,
    gap: 4,
  },
  settingExplainTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 6,
  },
  settingExplainBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginBottom: 12,
  },
  settingExplainInput: {
    alignSelf: "center",
    minWidth: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
  },
  classicSettingBlock: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  classicSettingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 4,
  },
  classicSettingBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginBottom: 8,
  },
  addActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  primaryAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  addActionPrimary: {
    backgroundColor: colors.primary,
  },
  addActionSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryActionText: {
    color: colors.primaryForeground,
    fontWeight: "600",
    fontSize: 15,
  },
  secondaryActionText: {
    color: colors.foreground,
    fontWeight: "600",
    fontSize: 15,
  },
  cardsListHeader: {
    backgroundColor: colors.tealBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    marginBottom: 4,
  },
  emptyState: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  floatingSaveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  floatingSaveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: "center",
  },
  floatingSaveText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 17 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.card,
  },
  headerSide: { minWidth: 64 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    color: colors.foreground,
  },
  content: { padding: 16, paddingBottom: 32 },
  backText: { fontSize: 16, color: colors.brand.teal },
  saveText: { fontSize: 16, fontWeight: "600", color: colors.brand.teal, textAlign: "right" },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12, color: colors.foreground },
  label: { fontSize: 14, color: colors.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
    color: colors.foreground,
  },
  inputEmbedded: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    color: colors.foreground,
  },
  inputLast: { marginBottom: 0 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.tealBg,
  },
  secondaryBtnText: { fontWeight: "600", fontSize: 15, color: colors.foreground },
  importBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  importBtnText: { fontWeight: "600", fontSize: 15, color: colors.foreground },
  disabled: { opacity: 0.4 },
  cardsHeading: { fontSize: 16, fontWeight: "600", marginBottom: 10, color: colors.foreground },
  emptyCards: { color: colors.muted, textAlign: "center", lineHeight: 20 },
  cardRow: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardRowEmbedded: {
    borderColor: colors.border,
    marginBottom: 10,
  },
  cardTextBlock: { marginBottom: 10 },
  cardMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  cardFront: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  cardBack: { fontSize: 15, color: colors.mutedLight, marginTop: 4 },
  nextReviewText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
    flexShrink: 1,
  },
  nextReviewDue: {
    color: colors.primary,
    fontWeight: "600",
  },
  nextReviewWithBadge: {
    flex: 1,
    minWidth: "50%",
  },
  learnedPill: {
    backgroundColor: colors.tealBg,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  learnedBadge: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
  },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  smallBtnText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 13 },
  smallBtnOutline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallBtnOutlineText: { color: colors.foreground, fontWeight: "600", fontSize: 13 },
  smallBtnDanger: {
    backgroundColor: colors.destructiveBg,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
  },
  smallBtnDangerText: { color: colors.destructive, fontWeight: "600", fontSize: 13 },
})
