import { useState, useEffect, useRef, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import type { Stack, GlobalSettings } from "../types"
import { useLocalStorage } from "./use-local-storage"
import { getSupabase } from "../lib/supabase"
import { DEFAULT_STACKS, DEFAULT_SETTINGS } from "../lib/defaults"

const STACKS_KEY = "focasaurus-stacks"
const SETTINGS_KEY = "focasaurus-settings"

interface UserDataRow {
  stacks: Stack[]
  global_settings: GlobalSettings
}

async function fetchUserData(userId: string): Promise<UserDataRow | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("user_data")
    .select("stacks, global_settings")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function saveUserData(
  userId: string,
  stacks: Stack[],
  globalSettings: GlobalSettings,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const { error } = await supabase.from("user_data").upsert({
    user_id: userId,
    stacks,
    global_settings: globalSettings,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export function useUserData(user: User | null, authLoading: boolean) {
  const [localStacks, setLocalStacks] = useLocalStorage<Stack[]>(STACKS_KEY, DEFAULT_STACKS)
  const [localSettings, setLocalSettings] = useLocalStorage<GlobalSettings>(
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
  )
  const [cloudStacks, setCloudStacks] = useState<Stack[] | null>(null)
  const [cloudSettings, setCloudSettings] = useState<GlobalSettings | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userIdRef = useRef<string | null>(null)

  const isLoggedIn = !!user
  const dataLoading = authLoading || (isLoggedIn && cloudStacks === null)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      userIdRef.current = null
      setCloudStacks(null)
      setCloudSettings(null)
      setSyncError(null)
      return
    }

    let cancelled = false
    userIdRef.current = user.id

    ;(async () => {
      try {
        const row = await fetchUserData(user.id)
        if (cancelled) return

        if (!row) {
          await saveUserData(user.id, localStacks, localSettings)
          if (cancelled) return
          setCloudStacks(localStacks)
          setCloudSettings(localSettings)
        } else {
          setCloudStacks(row.stacks)
          setCloudSettings(row.global_settings)
        }
        setSyncError(null)
      } catch (err) {
        if (cancelled) return
        setCloudStacks(localStacks)
        setCloudSettings(localSettings)
        setSyncError(err instanceof Error ? err.message : "Failed to load cloud data")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const stacks = isLoggedIn && cloudStacks !== null ? cloudStacks : localStacks
  const globalSettings =
    isLoggedIn && cloudSettings !== null ? cloudSettings : localSettings

  const setStacks = useCallback(
    (value: Stack[] | ((prev: Stack[]) => Stack[])) => {
      const update = (prev: Stack[]) => {
        const next = typeof value === "function" ? value(prev) : value
        if (isLoggedIn && userIdRef.current) {
          setCloudStacks(next)
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(async () => {
            setSyncing(true)
            try {
              await saveUserData(
                userIdRef.current!,
                next,
                cloudSettings ?? localSettings,
              )
              setSyncError(null)
            } catch (err) {
              setSyncError(err instanceof Error ? err.message : "Failed to save")
            } finally {
              setSyncing(false)
            }
          }, 500)
        } else {
          setLocalStacks(next)
        }
        return next
      }
      if (isLoggedIn && cloudStacks !== null) {
        setCloudStacks((prev) => update(prev ?? localStacks))
      } else {
        setLocalStacks((prev) => update(prev))
      }
    },
    [isLoggedIn, cloudStacks, cloudSettings, localSettings, setLocalStacks],
  )

  const setGlobalSettings = useCallback(
    (value: GlobalSettings | ((prev: GlobalSettings) => GlobalSettings)) => {
      const update = (prev: GlobalSettings) => {
        const next = typeof value === "function" ? value(prev) : value
        if (isLoggedIn && userIdRef.current) {
          setCloudSettings(next)
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(async () => {
            setSyncing(true)
            try {
              await saveUserData(userIdRef.current!, cloudStacks ?? localStacks, next)
              setSyncError(null)
            } catch (err) {
              setSyncError(err instanceof Error ? err.message : "Failed to save")
            } finally {
              setSyncing(false)
            }
          }, 500)
        } else {
          setLocalSettings(next)
        }
        return next
      }
      if (isLoggedIn && cloudSettings !== null) {
        setCloudSettings((prev) => update(prev ?? localSettings))
      } else {
        setLocalSettings((prev) => update(prev))
      }
    },
    [isLoggedIn, cloudStacks, cloudSettings, localStacks, setLocalSettings],
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return {
    stacks,
    setStacks,
    globalSettings,
    setGlobalSettings,
    dataLoading,
    syncing,
    syncError,
    isLoggedIn,
  }
}
