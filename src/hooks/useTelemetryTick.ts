import { useEffect, useRef } from "react"

export const TELEMETRY_TICK_MS = 100

export function useTelemetryTick(onTick: () => void | Promise<void>, intervalMs = TELEMETRY_TICK_MS) {
  const callback = useRef(onTick)
  callback.current = onTick

  useEffect(() => {
    const id = setInterval(() => void callback.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
