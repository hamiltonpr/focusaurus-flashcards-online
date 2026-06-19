import { useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { getSupabase } from "../lib/supabase"
import { isSupabaseConfigured } from "../lib/config"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured())
  const supabaseEnabled = isSupabaseConfigured()

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const supabase = getSupabase()
    if (supabase) await supabase.auth.signOut()
  }

  const deleteAccount = async (): Promise<{ error?: string }> => {
    const supabase = getSupabase()
    if (!supabase) return { error: "Supabase is not configured" }

    const { error } = await supabase.rpc("delete_user")
    if (error) return { error: error.message }

    await supabase.auth.signOut()
    return {}
  }

  return { user, session, loading, signOut, deleteAccount, supabaseEnabled }
}
