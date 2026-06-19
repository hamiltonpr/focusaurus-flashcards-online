import { StyleSheet, Text, View } from "react-native"
import AppPressable from "./AppPressable"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors } from "../theme/colors"

export type MainTab = "home" | "reading" | "settings"

export const TAB_BAR_HEIGHT = 56

interface BottomTabBarProps {
  active: MainTab
  onChange: (tab: MainTab) => void
}

const TABS: { id: MainTab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "reading", label: "Reading", icon: "📖" },
  { id: "settings", label: "Settings", icon: "⚙" },
]

export default function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const isActive = active === tab.id
        return (
          <AppPressable
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.icon, isActive && styles.labelActive]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </AppPressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: 6,
    minHeight: TAB_BAR_HEIGHT,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 2,
  },
  tabActive: {},
  icon: {
    fontSize: 20,
    color: colors.muted,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.muted,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
})
