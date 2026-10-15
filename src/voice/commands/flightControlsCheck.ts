import { executeFlow } from "@/services/flowRunner"
import { playSound, waitForSoundFinished } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"

// Surface deflection, so each call waits for the surface to reach its stop, not just the stick
const FULL_THRESHOLD = 0.95
// The elevator stops at -0.565 nose down, measured on the ground
const ELEVATOR_FULL_DOWN = -0.55
const NEUTRAL_THRESHOLD = 0.05

interface Step {
  condition: (t: Telemetry) => boolean
  sound: string
}

const STEPS: Step[] = [
  { condition: (t) => t.elevatorDeflection > FULL_THRESHOLD, sound: "full_up.ogg" },
  { condition: (t) => t.elevatorDeflection < ELEVATOR_FULL_DOWN, sound: "full_down.ogg" },
  { condition: (t) => Math.abs(t.elevatorDeflection) < NEUTRAL_THRESHOLD, sound: "neutral.ogg" },

  { condition: (t) => t.aileronDeflection < -FULL_THRESHOLD, sound: "full_left.ogg" },
  { condition: (t) => t.aileronDeflection > FULL_THRESHOLD, sound: "full_right.ogg" },
  { condition: (t) => Math.abs(t.aileronDeflection) < NEUTRAL_THRESHOLD, sound: "neutral.ogg" },

  { condition: (t) => t.rudderDeflection < -FULL_THRESHOLD, sound: "full_left.ogg" },
  { condition: (t) => t.rudderDeflection > FULL_THRESHOLD, sound: "full_right.ogg" },
  { condition: (t) => Math.abs(t.rudderDeflection) < NEUTRAL_THRESHOLD, sound: "neutral.ogg" }
]

function waitFor(condition: (t: Telemetry) => boolean): Promise<void> {
  return new Promise((resolve) => {
    // Check immediately in case the condition is already true
    const current = useTelemetryStore.getState().telemetry
    if (current && condition(current)) {
      resolve()
      return
    }

    // Subscribe — fires on every telemetry push from the backend
    const unsub = useTelemetryStore.subscribe((state) => {
      const t = state.telemetry
      if (t && condition(t)) {
        unsub()
        resolve()
      }
    })
  })
}

// Bumped on every call, so a check still waiting goes quiet once a newer one starts
let latestCheck = 0

export async function flightControlsCheck() {
  const check = ++latestCheck
  await waitForSoundFinished()

  for (const step of STEPS) {
    await waitFor(step.condition)
    if (check !== latestCheck) return
    await playSound(step.sound)
    await waitForSoundFinished()
  }

  executeFlow("after_flight_controls_check")
}
