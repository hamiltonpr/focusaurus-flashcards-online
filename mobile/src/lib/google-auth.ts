import { makeRedirectUri } from "expo-auth-session"
import * as QueryParams from "expo-auth-session/build/QueryParams"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import { getSupabase } from "./supabase"

WebBrowser.maybeCompleteAuthSession()

export function getAuthRedirectUri(): string {
  return makeRedirectUri({ scheme: "focasaurus", path: "auth/callback" })
}

function isAuthCallbackUrl(url: string): boolean {
  return url.includes("auth/callback") || url.includes("code=") || url.includes("access_token=")
}

function waitForDeepLink(timeoutMs = 120_000): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false

    const finish = (url: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      subscription.remove()
      resolve(url)
    }

    const timer = setTimeout(() => finish(null), timeoutMs)

    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (isAuthCallbackUrl(url)) finish(url)
    })

    Linking.getInitialURL().then((url) => {
      if (url && isAuthCallbackUrl(url)) finish(url)
    })
  })
}

async function completeSessionFromUrl(
  url: string,
): Promise<{ cancelled?: boolean; error?: string }> {
  const supabase = getSupabase()
  if (!supabase) return { error: "Supabase is not configured" }

  if (__DEV__) console.log("[auth] Callback received:", url)

  const { params, errorCode } = QueryParams.getQueryParams(url)
  if (errorCode) {
    if (__DEV__) console.log("[auth] OAuth error in callback:", errorCode)
    return { error: errorCode }
  }

  if (params.code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code)
    if (exchangeError) {
      if (__DEV__) console.log("[auth] Code exchange failed:", exchangeError.message)
      return { error: exchangeError.message }
    }
    return {}
  }

  if (params.access_token && params.refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    })
    if (sessionError) return { error: sessionError.message }
    return {}
  }

  return { error: "Sign-in did not return a session" }
}

export async function signInWithGoogle(): Promise<{ cancelled?: boolean; error?: string }> {
  const supabase = getSupabase()
  if (!supabase) return { error: "Supabase is not configured" }

  const redirectTo = getAuthRedirectUri()
  if (__DEV__) {
    console.log("[auth] redirectTo:", redirectTo)
    console.log("[auth] Add this exact URL (or exp://**) in Supabase → Auth → Redirect URLs")
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  })

  if (error) return { error: error.message }
  if (!data.url) return { error: "No auth URL returned" }

  const deepLinkPromise = waitForDeepLink()

  const browserPromise = WebBrowser.openAuthSessionAsync(data.url, redirectTo).then((result) => {
    if (__DEV__ && result.type !== "success") {
      console.log("[auth] Browser session ended:", result.type)
    }
    return result.type === "success" ? result.url : null
  })

  const callbackUrl = await Promise.race([browserPromise, deepLinkPromise])

  if (!callbackUrl) {
    return {
      error:
        "Sign-in could not return to the app. On iPhone + Expo Go this often fails with exp:// URLs. Try: npm run start:tunnel (then add the new redirect URL in Supabase), or use a development build.",
    }
  }

  return completeSessionFromUrl(callbackUrl)
}
