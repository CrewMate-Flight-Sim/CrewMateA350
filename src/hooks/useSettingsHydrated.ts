import { useEffect, useState } from "react"

import { useSettingsStore } from "@/store/settingsStore"

export function useSettingsHydrated() {
  const [hydrated, setHydrated] = useState(() => useSettingsStore.persist.hasHydrated())

  useEffect(() => {
    const unsub = useSettingsStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    setHydrated(useSettingsStore.persist.hasHydrated())

    return unsub
  }, [])

  return hydrated
}
