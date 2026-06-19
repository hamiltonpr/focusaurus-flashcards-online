import { FlatList, StyleSheet, Text, View } from "react-native"
import AppPressable from "./AppPressable"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import type { Stack } from "../types"
import { colors } from "../theme/colors"
import { TAB_BAR_HEIGHT } from "./BottomTabBar"

interface ReadingHubScreenProps {
  stacks: Stack[]
  onSelectStack: (stack: Stack) => void
}

export default function ReadingHubScreen({ stacks, onSelectStack }: ReadingHubScreenProps) {
  const insets = useSafeAreaInsets()
  const readableStacks = stacks.filter((s) => s.cards.length > 0)

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Guided Reading</Text>
        <Text style={styles.subheading}>
          Daily news and practice stories matched to your vocabulary
        </Text>
      </View>

      <FlatList
        data={readableStacks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No stacks ready</Text>
            <Text style={styles.emptyText}>
              Add cards to a stack on the Home tab, then come back here to read.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AppPressable style={styles.card} onPress={() => onSelectStack(item)}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cardMeta}>{item.cards.length} cards</Text>
          </AppPressable>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  heading: { fontSize: 26, fontWeight: "700", color: colors.foreground },
  subheading: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
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
  empty: { alignItems: "center", padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.foreground },
  emptyText: { color: colors.muted, marginTop: 8, textAlign: "center", lineHeight: 20 },
})
