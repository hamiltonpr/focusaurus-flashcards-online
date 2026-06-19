import { useEffect } from "react"
import { AppState, InteractionManager } from "react-native"
import type { GlobalSettings, Stack } from "../types"
import { rescheduleDueNotifications } from "../lib/notifications"

export function useDueNotifications(stacks: Stack[], settings: GlobalSettings) {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void rescheduleDueNotifications(stacks, settings)
    })
    return () => task.cancel()
  }, [stacks, settings])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void rescheduleDueNotifications(stacks, settings)
      }
    })
    return () => subscription.remove()
  }, [stacks, settings])
}
