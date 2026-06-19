import { useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native"
import AppPressable from "./AppPressable"
import { SafeAreaView } from "react-native-safe-area-context"
import { signInWithGoogle } from "../lib/google-auth"
import { colors } from "../theme/colors"

interface SignInScreenProps {
  onSignedIn: () => void
  onContinueWithoutAccount: () => void
}

export default function SignInScreen({ onSignedIn, onContinueWithoutAccount }: SignInScreenProps) {
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    const result = await signInWithGoogle()
    setLoading(false)

    if (result.error) {
      Alert.alert("Sign in failed", result.error)
      return
    }
    if (result.cancelled) return

    onSignedIn()
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} />
        <Text style={styles.heading}>Focasaurus</Text>
        <Text style={styles.tagline}>Flashcards that stick</Text>

        <Text style={styles.description}>
          Sign in to sync your stacks across devices and keep your progress backed up.
        </Text>

        <AppPressable
          style={[styles.googleBtn, loading && styles.disabled]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <Text style={styles.googleBtnText}>Sign in with Google</Text>
          )}
        </AppPressable>

        <AppPressable style={styles.skipBtn} onPress={onContinueWithoutAccount} disabled={loading}>
          <Text style={styles.skipBtnText}>Continue without account</Text>
        </AppPressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 18,
    marginBottom: 8,
  },
  heading: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.foreground,
  },
  tagline: {
    fontSize: 16,
    color: colors.muted,
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  googleBtn: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
    marginTop: 8,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
  },
  skipBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
  },
  disabled: { opacity: 0.6 },
})
