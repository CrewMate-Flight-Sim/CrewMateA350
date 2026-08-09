import { listen } from "@tauri-apps/api/event"

import { simvarGet, simvarSet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { getChecklistById } from "@/services/checklistLoader"
import { isSoundPlaying, playSound, playSoundSequence } from "@/services/playSounds"
import { useChecklistStore } from "@/store/checklistStore"
import { usePerformanceStore } from "@/store/performanceStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import { useVoiceHintProgressStore } from "@/store/voiceHintProgressStore"
import type { Check, ChecklistItem, ValidationRule } from "@/types/checklist"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIMVAR = { READ_RETRIES: 5, READ_RETRY_DELAY: 150 }
const SILENT_COMPLETION_DELAY_MS = 2000
const AUTO_CHECK_RETRY_DELAY = 2000

const NUMBER_WORD_PATTERN = `(?:zero|one|two|three|four|five|six|seven|eight|nine|niner|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)`
const NUMBER_WORDS_RE = new RegExp(`\\b${NUMBER_WORD_PATTERN}(?:[\\s-]+${NUMBER_WORD_PATTERN}){0,3}\\b`, "i")

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

async function waitForSoundFinished(): Promise<void> {
  while (await isSoundPlaying()) await delay(100)
}

async function playSyncSound(soundFile: string): Promise<void> {
  await waitForSoundFinished()
  await playSound(soundFile)
  await waitForSoundFinished()
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw new Error("Checklist aborted")
}

// ---------------------------------------------------------------------------
// Speech input
// ---------------------------------------------------------------------------

async function waitForSpeechResponse(signal: AbortSignal): Promise<string | null> {
  if (signal.aborted) return null

  return new Promise<string | null>((resolve) => {
    let unlistenFn: (() => void) | null = null
    let resolved = false

    const done = (value: string | null) => {
      if (resolved) return
      resolved = true
      unlistenFn?.()
      resolve(value)
    }

    signal.addEventListener("abort", () => done(null), { once: true })

    listen<{ text?: string; type?: string }>("speech_recognized", (event) => {
      if (event.payload?.type === "speech_unrecognized") return
      const text = event.payload?.text?.trim().toLowerCase()
      if (text) done(text)
    }).then((fn) => {
      unlistenFn = fn
      if (signal.aborted) done(null)
    })
  })
}

function matchesResponse(spoken: string, token: string): boolean {
  if (token === "*") return true
  if (token === "#2") return /\b\d{2}\b/.test(spoken)
  if (token === "#3") return /\b\d{3}\b/.test(spoken)
  if (token === "#4") return /\b\d{4}\b/.test(spoken)
  return spoken.includes(token.toLowerCase())
}

function matchesAnyResponse(spoken: string, responses: string[]): boolean {
  return responses.some((r) => matchesResponse(spoken, r))
}

// ---------------------------------------------------------------------------
// SimVar / store readers
// ---------------------------------------------------------------------------

function getStoreValue(storePath: string): string | undefined {
  const state = usePerformanceStore.getState() as unknown as Record<string, Record<string, string>>
  const [section, key] = storePath.split(".")
  return state[section]?.[key]
}

async function readSimVar(expression: string): Promise<number | null> {
  for (let attempt = 0; attempt < SIMVAR.READ_RETRIES; attempt++) {
    try {
      const value = await simvarGet(expression)
      if (value !== null) {
        console.log(
          `[ChecklistRunner] readSimVar("${expression}") → ${value}${attempt > 0 ? ` (attempt ${attempt + 1})` : ""}`
        )
        return value
      }
    } catch (err) {
      console.warn(`[ChecklistRunner] Failed to read simvar "${expression}":`, err)
      return null
    }
    await delay(SIMVAR.READ_RETRY_DELAY)
  }
  console.warn(`[ChecklistRunner] readSimVar("${expression}") → null after retries`)
  return null
}

// ---------------------------------------------------------------------------
// Check evaluation
// ---------------------------------------------------------------------------

async function runChecks(checks: Check[], signal: AbortSignal): Promise<boolean> {
  for (const check of checks) {
    let pass = false

    if (check.type === "any") {
      for (const group of check.groups ?? []) {
        if (await runChecks(group, signal)) {
          pass = true
          break
        }
      }
    }

    if (check.type === "simvar") {
      const raw = await readSimVar(check.var!)
      checkAbort(signal)

      let expected: number | null = null
      if (typeof check.expected === "boolean") {
        expected = check.expected ? 1 : 0
      } else if (typeof check.expected === "number") {
        expected = check.expected
      } else if (typeof check.expected === "object" && check.expected !== null) {
        const storeRaw = getStoreValue(check.expected.store)
        if (storeRaw !== undefined) {
          const n = parseFloat(String(storeRaw))
          expected = isNaN(n) ? null : n
        }
      }

      if (typeof check.expected === "boolean") {
        // Boolean SimVars: compare truthy/falsy
        const rawBool = raw !== null ? (raw > 0.5 ? 1 : 0) : null
        pass = rawBool !== null && expected !== null && rawBool === expected
      } else {
        // Numeric SimVars: compare with tolerance
        pass = raw !== null && expected !== null && Math.abs(raw - expected) < 0.5
      }
    }

    if (check.type === "store") {
      pass = getStoreValue(check.store!) === check.equals
    }

    if (!pass) {
      console.log(
        `[ChecklistRunner] check FAILED: type="${check.type}" var="${check.var ?? check.store}" expected="${check.expected ?? check.equals}"`
      )
      return false
    }
  }

  return true
}

async function findPassingRule(
  validations: ValidationRule[],
  spoken: string,
  signal: AbortSignal
): Promise<ValidationRule | null> {
  // Find the rule whose response token best (longest) matches spoken
  let bestMatch: ValidationRule | undefined
  let bestLen = -1

  for (const rule of validations) {
    for (const token of rule.when.responses ?? []) {
      if (matchesResponse(spoken, token) && token.length > bestLen) {
        bestLen = token.length
        bestMatch = rule
      }
    }
  }

  // If a response-based rule matched, only check that one
  if (bestMatch) {
    const ok = await runChecks(bestMatch.checks ?? [], signal)
    return ok ? bestMatch : null
  }

  // No response matched — try always/store rules in order (handles silent mode
  // and items with no response-based validations)
  for (const rule of validations) {
    const w = rule.when
    const conditionMet = (w.store && getStoreValue(w.store.path) === w.store.equals) || w.always === true
    if (!conditionMet) continue

    const ok = await runChecks(rule.checks ?? [], signal)
    if (ok) return rule
  }

  return null
}

// ---------------------------------------------------------------------------
// Checklist runner
// ---------------------------------------------------------------------------

class ChecklistRunner {
  private abortController: AbortController | null = null

  // ── Public API ────────────────────────────────────────────────────────────

  abort(): void {
    this.abortController?.abort()
    this.abortController = null
  }

  async execute(checklistId: string): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    const store = useChecklistStore.getState()
    const checklist = getChecklistById(checklistId)
    if (!checklist) {
      store.setError(`Checklist "${checklistId}" not found`)
      return
    }

    store.setChecklist(checklist)

    this.abortController = new AbortController()
    const { signal } = this.abortController

    const silent = checklist.mode === "silent"

    try {
      await this.triggerChecklistMenu()

      if (silent) {
        const allPassed = await this.runSilentItems(checklist.items, signal)
        if (allPassed) {
          await this.playSilentCompletion(checklist.completion)
          store.setExecutionState("completed")
          this.onChecklistCompleted(checklist.id)
        } else {
          store.setExecutionState("error")
        }
      } else {
        await this.runItems(checklist.items, signal)
        await playSyncSound(checklist.completion)
        store.setExecutionState("completed")
        this.onChecklistCompleted(checklist.id)
      }
    } catch (err) {
      const message = String(err)
      if (message.includes("aborted")) {
        store.setExecutionState("aborted")
      } else {
        store.setError(message)
      }
    } finally {
      this.abortController = null
    }
  }

  // ── MCDU integration ──────────────────────────────────────────────────────

  private async triggerChecklistMenu(): Promise<void> {
    await simvarSet(`1 (>L:INI_MCDU2_CL_MENU)`)
  }

  // ── Silent-mode item iteration ────────────────────────────────────────────
  // No speech is expected; each item is judged purely on always/store rules.

  private async runSilentItems(items: ChecklistItem[], signal: AbortSignal): Promise<boolean> {
    let allPassed = true
    for (let i = 0; i < items.length; i++) {
      checkAbort(signal)
      useChecklistStore.getState().setStepIndex(i)
      const passed = await this.runSilentItem(items[i], i, signal)
      if (!passed) allPassed = false
      checkAbort(signal)
    }
    return allPassed
  }

  private async runSilentItem(item: ChecklistItem, index: number, signal: AbortSignal): Promise<boolean> {
    const { setStepStatus } = useChecklistStore.getState()
    setStepStatus(index, "active")
    checkAbort(signal)

    if (item.validations?.length) {
      // Empty spoken string — silent mode has no speech, only always/store conditions apply
      const rule = await findPassingRule(item.validations, "", signal)

      if (!rule) {
        if (item.incorrect) await playSyncSound(item.incorrect)
        setStepStatus(index, "failed")
        return false
      }
    }

    setStepStatus(index, "complete")
    return true
  }

  private async playSilentCompletion(completionSound: string): Promise<void> {
    await waitForSoundFinished()
    await delay(SILENT_COMPLETION_DELAY_MS)
    await playSound(completionSound)
    await waitForSoundFinished()
  }

  // ── Normal-mode item iteration ────────────────────────────────────────────

  private async runItems(items: ChecklistItem[], signal: AbortSignal): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      checkAbort(signal)
      useChecklistStore.getState().setStepIndex(i)
      await this.executeItem(items[i], i, signal)
      checkAbort(signal)
    }
  }

  private async executeItem(item: ChecklistItem, index: number, signal: AbortSignal): Promise<void> {
    const { setStepStatus } = useChecklistStore.getState()
    setStepStatus(index, "active")

    if (!item.challenge) {
      await this.runAutoCheckItem(item, signal)
      setStepStatus(index, "complete")
      return
    }

    const aborted = await this.runInteractiveItem(item, signal)
    if (aborted) return // status left as "active"; execution is stopping anyway

    if (item.copilot_response) {
      await playSyncSound(item.copilot_response)
    }

    setStepStatus(index, "complete")
  }

  // ── Auto-check phase (no challenge, validations only) ─────────────────────

  private async runAutoCheckItem(item: ChecklistItem, signal: AbortSignal): Promise<void> {
    if (item.validations?.length) {
      while (true) {
        checkAbort(signal)
        if (await findPassingRule(item.validations, "", signal)) break
        if (item.incorrect) await playSyncSound(item.incorrect)
        await delay(AUTO_CHECK_RETRY_DELAY)
      }
    }
  }

  // ── Normal interactive phase (challenge → speech response → confirmations) ─
  // Note: unlike a plain pass/fail item, a validated response here still falls
  // through to play takeoff/baro confirmation audio afterward — validation
  // success does not short-circuit the rest of the item.

  // Returns true if the item ended because the checklist was aborted.
  private async runInteractiveItem(item: ChecklistItem, signal: AbortSignal): Promise<boolean> {
    const responseList = item.response ?? []
    const hold = () => useSettingsStore.getState().holdOnIncorrect

    while (true) {
      checkAbort(signal)
      await playSyncSound(item.challenge!)
      checkAbort(signal)

      const spoken = await this.waitForValidResponse(item, responseList, signal)
      if (spoken === null) return true // aborted
      checkAbort(signal)

      if (item.validations?.length) {
        const rule = await findPassingRule(item.validations, spoken, signal)

        if (!rule) {
          await playSyncSound(item.incorrect ?? "are_you_sure.ogg")
          if (hold()) continue
          else break
        }

        if (rule.copilot_response) {
          await playSyncSound(rule.copilot_response)
        }
      }

      if (item.takeoff_confirmation) {
        await this.playTakeoffConfirmation()
      }

      if (item.baro_confirmation) {
        await this.playBaroConfirmation(spoken)
      }

      break
    }

    return false
  }

  // Waits for a spoken response, filtering out takeoff-speed and baro/feet
  // confirmations that don't yet contain the required content.
  private async waitForValidResponse(
    item: ChecklistItem,
    responseList: string[],
    signal: AbortSignal
  ): Promise<string | null> {
    while (true) {
      const spoken = await waitForSpeechResponse(signal)
      if (spoken === null) return null

      if (responseList.length === 0 || matchesAnyResponse(spoken, responseList)) {
        if (item.takeoff_confirmation && !spoken.includes("set and checked")) {
          const { thrustSetting } = usePerformanceStore.getState().takeoff
          const hasV1 = /\bv\s*1\b/.test(spoken) || /\bv\s*one\b/i.test(spoken)
          const hasVR = /\bv\s*r\b/.test(spoken) || /\bv\s*rotate\b/i.test(spoken)
          const hasV2 = /\bv\s*2\b/.test(spoken) || /\bv\s*two\b/i.test(spoken)
          const hasThrust = thrustSetting === "flex" ? /\bflex\b/i.test(spoken) : /\btoga\b/i.test(spoken)
          if (!(hasV1 && hasVR && hasV2 && hasThrust)) continue
        }

        const expectsFeet = responseList.some((r) => r.toLowerCase().includes("feet"))
        if ((item.baro_confirmation || expectsFeet) && !spoken.includes("set and checked")) {
          if (!(/\b\d{2,4}\b/.test(spoken) || NUMBER_WORDS_RE.test(spoken))) continue
        }

        return spoken
      }
    }
  }

  private async playTakeoffConfirmation(): Promise<void> {
    const { v1, vr, v2, thrustSetting } = usePerformanceStore.getState().takeoff
    const t = useTelemetryStore.getState().telemetry
    const digits = (n: number) =>
      String(Math.round(n))
        .split("")
        .map((d) => `${d}.ogg`)

    const filenames: string[] = ["v_one.ogg", ...digits(v1), "v_r.ogg", ...digits(vr), "v_2.ogg", ...digits(v2)]

    if (thrustSetting === "flex") {
      const flexTemp = t?.iniFlexTemperature ?? 0
      filenames.push("flex.ogg", ...digits(flexTemp))
    } else {
      filenames.push("TOGA.ogg")
    }

    await playSoundSequence(filenames)
  }

  private async playBaroConfirmation(spoken: string): Promise<void> {
    const t = useTelemetryStore.getState().telemetry
    if (t === null) return

    const spokenMatch = spoken.match(/\b(\d{3,4})\b/)
    const spokenNum = spokenMatch ? parseInt(spokenMatch[1], 10) : null
    const isHpa = spokenNum !== null ? spokenNum >= 920 && spokenNum <= 1060 : t.cptBaro === 1
    const value = isHpa ? Math.round(t.captAltimeterSettingMB ?? 0) : Math.round((t.captAltimeterSettingHG ?? 0) * 100)
    const filenames = [
      ...String(value)
        .split("")
        .map((d) => `${d}.ogg`),
      "set.ogg"
    ]
    await playSoundSequence(filenames)
  }

  // ── Completion side-effects ───────────────────────────────────────────────

  private onChecklistCompleted(checklistId: string): void {
    useVoiceHintProgressStore.getState().recordChecklistCompleted(checklistId)
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton + public API
// ---------------------------------------------------------------------------

const runner = new ChecklistRunner()

export const executeChecklist = (checklistId: string): Promise<void> => runner.execute(checklistId)
export const abortChecklist = (): void => runner.abort()
