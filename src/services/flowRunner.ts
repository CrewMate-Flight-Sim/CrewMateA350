import { simvarGet, simvarSet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { getFlowById, resolveFlow } from "@/services/flowLoader"
import { playSound, isSoundPlaying } from "@/services/playSounds"
import { useFlowStore } from "@/store/flowStore"
import { usePerformanceStore } from "@/store/performanceStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import { useVoiceHintProgressStore } from "@/store/voiceHintProgressStore"
import type { Flow } from "@/types/flow"
import type { FlowStep } from "@/types/flow"
import type { FlowConditionValue } from "@/types/flow"

function getRandomDelay(): number {
  // Random delay between 500ms and 1500ms
  return Math.random() * 1000 + 500
}

let abortController: AbortController | null = null

async function waitForSoundFinished() {
  while (await isSoundPlaying()) {
    await delay(100)
  }
}

function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new Error("Flow aborted")
}

async function abortableSleep(ms: number, signal: AbortSignal) {
  const interval = 100
  let elapsed = 0
  while (elapsed < ms) {
    checkAbort(signal)
    const chunk = Math.min(interval, ms - elapsed)
    await delay(chunk)
    elapsed += chunk
  }
}

async function readValue(expression: string): Promise<number | null> {
  // On first registration the SimConnect cache may not be populated yet.
  // Retry a few times with a short delay before giving up.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const value = await simvarGet(expression)
      if (value !== null) return value
    } catch (err) {
      console.warn(`[FlowRunner] Failed to read "${expression}":`, err)
      return null
    }
    await delay(150)
  }
  return null
}

async function writeValue(expression: string): Promise<void> {
  try {
    await simvarSet(expression)
  } catch (err) {
    console.error(`[FlowRunner] Failed to write "${expression}":`, err)
    throw err
  }
}

function toNumber(value: number | string): number {
  return typeof value === "string" ? parseFloat(value) : value
}

function matchesValue(actual: number | null, expected: FlowConditionValue): boolean {
  if (typeof expected !== "number" && typeof expected !== "string") {
    return false
  }
  return actual !== null && Math.abs(actual - toNumber(expected)) < 0.5
}

function resolveFlowOption(path: string): unknown {
  const { takeoff, landing } = usePerformanceStore.getState()
  const { lightsControlMode } = useSettingsStore.getState()
  const root: Record<string, unknown> = {
    takeoff,
    landing,
    settings: { lightsControlMode }
  }
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") {
      return undefined
    }
    return (acc as Record<string, unknown>)[key]
  }, root)
}

function matchesOptionValue(actual: unknown, expected: FlowConditionValue): boolean {
  if (typeof actual === "number" && typeof expected === "number") {
    return Math.abs(actual - expected) < 0.5
  }

  if (
    (typeof actual === "number" || typeof actual === "string") &&
    (typeof expected === "number" || typeof expected === "string")
  ) {
    const actualNum = Number(actual)
    const expectedNum = Number(expected)
    if (!Number.isNaN(actualNum) && !Number.isNaN(expectedNum)) {
      return Math.abs(actualNum - expectedNum) < 0.5
    }
  }

  return String(actual) === String(expected)
}

async function shouldExecuteStep(step: FlowStep): Promise<boolean> {
  const condition = step.only_if
  if (!condition) {
    return true
  }

  if ("option" in condition) {
    const optionValue = resolveFlowOption(condition.option)
    if (optionValue === undefined) {
      console.warn(`[FlowRunner] Step "${step.label}" condition option not found: "${condition.option}"`)
      return false
    }
    return condition.one_of.some((expected) => matchesOptionValue(optionValue, expected))
  }

  const conditionValue = await readValue(condition.read)
  if (conditionValue === null) {
    console.warn(`[FlowRunner] Step "${step.label}" condition read failed for "${condition.read}"`)
    return false
  }

  return condition.one_of.some((expected) => matchesValue(conditionValue, expected))
}

// Post-landing silent timer (announces when it expires)
// Driven by the simulator chrono (INI_FO_CHRONO) count-up instead of an internal clock.
// The chrono button is pressed by the callouts hook 2 seconds after the 70-knot callout.
// The chrono counts up in seconds; when it reaches 300 (5 minutes) the timer expires.
const CHRONO_5_MINUTES = 300

let postLandingTimerActive = false
let postLandingTimerSoundPlayed = false
let postLandingChronoTimeoutId: ReturnType<typeof setTimeout> | null = null

export function isPostLandingTimerActive(): boolean {
  return postLandingTimerActive
}

function clearPostLandingTimer(): void {
  if (postLandingChronoTimeoutId) {
    clearTimeout(postLandingChronoTimeoutId as unknown as number)
    postLandingChronoTimeoutId = null
  }
  postLandingTimerActive = false
  postLandingTimerSoundPlayed = false
}

async function checkPostLandingChrono(): Promise<void> {
  if (postLandingTimerSoundPlayed) return

  const telemetry = useTelemetryStore.getState().telemetry
  if (!telemetry) return

  const chronoValue = telemetry.iniFoCrono
  if (typeof chronoValue !== "number") return

  if (chronoValue > 0 && chronoValue < CHRONO_5_MINUTES) {
    postLandingTimerActive = true
  } else if (chronoValue >= CHRONO_5_MINUTES) {
    postLandingTimerActive = false
    postLandingTimerSoundPlayed = true
    try {
      await simvarSet("1 (>L:INI_FO_CHRONO_BUTTON)")
    } catch (err) {
      console.error("[FlowRunner] Failed to fire INI_FO_CHRONO_BUTTON:", err)
    }
    try {
      await playSound("five_minutes.ogg")
    } catch (err) {
      console.error("[FlowRunner] Failed to play post-landing expiry announcement:", err)
    }
  }
}

async function pollPostLandingChrono(): Promise<void> {
  await checkPostLandingChrono()
  if (!postLandingTimerSoundPlayed) {
    postLandingChronoTimeoutId = setTimeout(pollPostLandingChrono, 1000)
  }
}

export function startPostLandingTimer(): void {
  clearPostLandingTimer()
  postLandingChronoTimeoutId = setTimeout(pollPostLandingChrono, 1000)
}

export async function executeFlow(flowId: string): Promise<void> {
  const store = useFlowStore.getState()

  if (abortController) {
    abortController.abort()
    abortController = null
  }

  const rawFlow = getFlowById(flowId)
  if (!rawFlow) {
    store.setError(`Flow "${flowId}" not found`)
    return
  }

  // Guard engine shutdown flows while post-landing timer is active
  const engineShutdownIds = new Set(["shutdown_eng1", "shutdown_eng2"])
  if (engineShutdownIds.has(flowId)) {
    const settings = useSettingsStore.getState()
    if (settings.postLandingShutdownEnabled && isPostLandingTimerActive()) {
      try {
        await playSound("five_minutes_not_passed.ogg")
      } catch (err) {
        console.error("[FlowRunner] Failed to play blocked shutdown announcement:", err)
      }
      return
    }
  }

  const flow: Flow = await resolveFlow(rawFlow)

  store.setFlow(flow)

  abortController = new AbortController()
  const { signal } = abortController

  try {
    if (flow.sound_start) {
      await waitForSoundFinished()
      await playSound(flow.sound_start)
      await waitForSoundFinished()
    }

    for (let i = 0; i < flow.steps.length; i++) {
      checkAbort(signal)

      const step = flow.steps[i]
      const { setStepIndex, setStepStatus } = useFlowStore.getState()

      setStepIndex(i)
      setStepStatus(i, "executing")

      if (!(await shouldExecuteStep(step))) {
        setStepStatus(i, "skipped")
        if (i < flow.steps.length - 1 && !step.skip_delay) {
          await abortableSleep(getRandomDelay(), signal)
        }
        continue
      }

      if (i > 0 && flow.steps[i - 1].skip_delay) {
        await abortableSleep(100, signal)
      }
      const currentValue = await readValue(step.read)
      checkAbort(signal)

      const expectedValue = toNumber(step.expect)
      console.log(`[FlowRunner] Step "${step.label}": read=${currentValue}, expect=${expectedValue}`)
      if (matchesValue(currentValue, expectedValue)) {
        // Already in correct state — skip but still honour wait_ms
        if (step.wait_ms) {
          await abortableSleep(step.wait_ms, signal)
        }
        setStepStatus(i, "skipped")
        continue
      }

      await writeValue(step.on)
      checkAbort(signal)

      if (step.sound_on_execute) {
        await waitForSoundFinished()
        await playSound(step.sound_on_execute)
        await waitForSoundFinished()
        checkAbort(signal)
      }

      if (step.hold_ms) {
        await abortableSleep(step.hold_ms, signal)
        const releaseExpr = step.on.replace(/^-?\d+\s+/, "0 ")
        await writeValue(releaseExpr)
        checkAbort(signal)
      }

      if (step.wait_ms) {
        await abortableSleep(step.wait_ms, signal)
      }

      if (step.skip_verify) {
        setStepStatus(i, "done")
        if (step.sound_after_execute) {
          await abortableSleep(2000, signal)
          await waitForSoundFinished()
          await playSound(step.sound_after_execute)
          await waitForSoundFinished()
        }
      } else {
        setStepStatus(i, "verifying")
        let verified = false
        for (let attempt = 0; attempt < 5; attempt++) {
          checkAbort(signal)
          if (!step.skip_delay) await delay(300)
          const newValue = await readValue(step.read)
          if (matchesValue(newValue, expectedValue)) {
            verified = true
            break
          }
        }

        setStepStatus(i, verified ? "done" : "failed")
        if (!verified) {
          console.warn(`[FlowRunner] Step "${step.label}" verification failed (expected ${expectedValue})`)
        } else {
          // Play sound_after_execute if step was successful (after 2 second delay)
          if (step.sound_after_execute) {
            if (!step.skip_delay) await abortableSleep(2000, signal)
            await waitForSoundFinished()
            await playSound(step.sound_after_execute)
            await waitForSoundFinished()
            checkAbort(signal)
          }
        }
      }

      if (i < flow.steps.length - 1 && !step.skip_delay) {
        await abortableSleep(getRandomDelay(), signal)
      }
    }

    useFlowStore.getState().setExecutionState("completed")
    useVoiceHintProgressStore.getState().recordFlowCompleted(flow.id)
    if (flow.id === "shutdown") {
      useVoiceHintProgressStore.getState().resetForColdGround()
    }

    if (flow.sound_end) {
      await waitForSoundFinished()
      await playSound(flow.sound_end)
    }
  } catch (err) {
    if (signal.aborted) {
      useFlowStore.getState().setExecutionState("aborted")
    } else {
      useFlowStore.getState().setError(err instanceof Error ? err.message : String(err))
    }
  } finally {
    abortController = null
  }
}

export function abortFlow(): void {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  useFlowStore.getState().setExecutionState("aborted")
}
