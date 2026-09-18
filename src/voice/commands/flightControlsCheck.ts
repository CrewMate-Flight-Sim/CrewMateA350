import { executeFlow } from "@/services/flowRunner"
import { playSound, isSoundPlaying } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"

const FULL_THRESHOLD = 0.45
const NEUTRAL_THRESHOLD = 0.15

interface Step {
  condition: (t: Telemetry) => boolean
  sound: string
}

const steps: Step[] = [
  { condition: (t) => t.elevatorPosition > FULL_THRESHOLD, sound: "full_up.ogg" },
  { condition: (t) => t.elevatorPosition < -FULL_THRESHOLD, sound: "full_down.ogg" },
  { condition: (t) => Math.abs(t.elevatorPosition) < NEUTRAL_THRESHOLD, sound: "neutral.ogg" },

  { condition: (t) => t.aileronPosition < -FULL_THRESHOLD, sound: "full_left.ogg" },
  { condition: (t) => t.aileronPosition > FULL_THRESHOLD, sound: "full_right.ogg" },
  { condition: (t) => Math.abs(t.aileronPosition) < NEUTRAL_THRESHOLD, sound: "neutral.ogg" },

  { condition: (t) => t.rudderPosition < -FULL_THRESHOLD, sound: "full_left.ogg" },
  { condition: (t) => t.rudderPosition > FULL_THRESHOLD, sound: "full_right.ogg" },
  { condition: (t) => Math.abs(t.rudderPosition) < NEUTRAL_THRESHOLD, sound: "neutral.ogg" }
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

/** Resolves once the backend reports no sound is playing. */
function waitForSoundDone(): Promise<void> {
  return new Promise((resolve) => {
    const id = setInterval(async () => {
      if (!(await isSoundPlaying())) {
        clearInterval(id)
        resolve()
      }
    }, 50)
  })
}

export async function flightControlsCheck() {
  await waitForSoundDone()

  for (const step of steps) {
    await waitFor(step.condition)
    await playSound(step.sound)
    await waitForSoundDone()
  }

  executeFlow("after_flight_controls_check")
}
