import { simvarSet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { useTelemetryStore } from "@/store/telemetryStore"

const DETENT_EVENTS = ["FLAPS_UP", "FLAPS_1", "FLAPS_2", "FLAPS_3", "FLAPS_DOWN"]
const DETENT_DELAY_MS = 400

// iniBuilds moves the lever but not the flaps on a direct jump to 3, so pass every detent like a pilot would
export async function moveFlapsLever(target: number) {
  if (!DETENT_EVENTS[target]) return

  const current = Math.round(useTelemetryStore.getState().telemetry?.flapsIndex ?? 0)
  const direction = target > current ? 1 : -1

  for (let detent = current + direction; detent !== target + direction; detent += direction) {
    await simvarSet(`(>K:${DETENT_EVENTS[detent]})`)
    if (detent !== target) await delay(DETENT_DELAY_MS)
  }
}
