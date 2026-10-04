import { useEffect, useRef } from "react"

import { simvarSet } from "@/API/simvarApi"
import { useTelemetryStore } from "@/store/telemetryStore"

const COOLDOWN_MS = 500

// Only with linked instruments off (the aircraft syncs them otherwise); the pressure itself is read-only, so just the inHg/hPa unit follows the Captain
export function useBaroSync() {
  const lastWriteRef = useRef<number>(0)

  useEffect(() => {
    const unsubscribe = useTelemetryStore.subscribe((state) => {
      const t = state.telemetry
      if (!t) return

      if (t.linkedInstruments !== 0) return

      const cptBaro = t.cptBaro
      const foBaro = t.foBaro
      if (cptBaro === undefined || foBaro === undefined) return
      if (cptBaro === foBaro) return

      const now = Date.now()
      if (now - lastWriteRef.current < COOLDOWN_MS) return

      lastWriteRef.current = now
      void simvarSet(`${cptBaro} (>L:XMLVAR_BARO_Selector_HPA_2)`)
    })

    return unsubscribe
  }, [])
}
