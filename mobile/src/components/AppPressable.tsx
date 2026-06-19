import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { colors } from "../theme/colors"

export interface AppPressableProps extends PressableProps {
  /** Dim on press / show Android ripple. Turn off for full-screen overlays. */
  feedback?: boolean
}

function resolveStyle(
  style: PressableProps["style"],
  pressed: boolean,
  feedback: boolean,
  disabled: boolean | null | undefined,
): StyleProp<ViewStyle> {
  const state = { pressed }
  const base = typeof style === "function" ? style(state) : style
  if (!feedback || !pressed || disabled) return base
  return [base, { opacity: 0.72 }]
}

export default function AppPressable({
  style,
  feedback = true,
  disabled,
  android_ripple,
  ...props
}: AppPressableProps) {
  return (
    <Pressable
      delayPressIn={0}
      delayPressOut={0}
      pressRetentionOffset={12}
      disabled={disabled}
      android_ripple={
        feedback && !disabled
          ? (android_ripple ?? { color: `${colors.primary}22`, foreground: true })
          : undefined
      }
      style={({ pressed }) => resolveStyle(style, pressed, feedback, disabled)}
      {...props}
    />
  )
}
