import { useState, useEffect, useCallback, useRef } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

type SetValue<T> = T | ((prev: T) => T)

const SAVE_DEBOUNCE_MS = 300

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: SetValue<T>) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [loaded, setLoaded] = useState(false)
  const storedValueRef = useRef(storedValue)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    storedValueRef.current = storedValue
  }, [storedValue])

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((item) => {
        if (item !== null) setStoredValue(JSON.parse(item))
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [key])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const setValue = useCallback(
    (value: SetValue<T>) => {
      const next =
        typeof value === "function" ? (value as (prev: T) => T)(storedValueRef.current) : value
      storedValueRef.current = next
      setStoredValue(next)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        AsyncStorage.setItem(key, JSON.stringify(storedValueRef.current)).catch(() => {})
      }, SAVE_DEBOUNCE_MS)
    },
    [key],
  )

  return [storedValue, setValue, loaded]
}
