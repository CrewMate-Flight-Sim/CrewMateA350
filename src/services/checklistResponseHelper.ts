import { usePerformanceStore } from "@/store/performanceStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { ChecklistItem } from "@/types/checklist"

export const WEIGHT_UNITS = new Set(["tons", "kilograms", "pounds", "kilograms balanced", "pounds balanced"])

/** Applies final display formatting: weight units → "xxx.x <unit>", feet → "xxxx feet" */
export function renderResponseToken(token: string): string {
  if (WEIGHT_UNITS.has(token)) return `xxx.x ${token}`
  if (token === "feet") return "xxxx feet"
  return token
}

export function formatResponseToken(token: string): string {
  if (token === "#2") return "##"
  if (token === "#3") return "###"
  if (token === "#4") return "####"
  // Replace any embedded #N placeholders (e.g. "#4 set") with visual hashes
  return token.replace(/#4/g, "####").replace(/#3/g, "###").replace(/#2/g, "##")
}

export function getDisplayResponses(item: ChecklistItem): string[] {
  const base = (item.response ?? []).map(formatResponseToken)

  const extras: string[] = []

  // Baro confirmation: show clear examples the pilot can say
  if (item.baro_confirmation) {
    extras.push("qnh #4 set", "altimeter #4 set", "#4 set")
  }

  // Runway confirmation: show the runway entered in the Takeoff Plan
  if (item.rwy_confirmation) {
    const runway = usePerformanceStore.getState().takeoff.runway?.trim()
    if (runway) extras.push(`${runway.toUpperCase()} confirmed`)
  }

  // Takeoff confirmation: show only the currently-configured thrust variant + safeword
  if (item.takeoff_confirmation) {
    const { v1, vr, v2, thrustSetting } = usePerformanceStore.getState().takeoff
    const flexTemp = useTelemetryStore.getState().telemetry?.iniFlexTemperature
    const thrust = thrustSetting === "flex" ? `flex ${flexTemp !== undefined ? Math.round(flexTemp) : "??"}` : "toga"
    extras.push(`v1 ${v1} vr ${vr} v2 ${v2} ${thrust}`, "set and checked")
    return extras
  }

  // If an item expects feet (minimums), show BARO/RADIO examples
  if ((item.response ?? []).some((r) => r.toLowerCase().includes("feet"))) {
    extras.push("baro #3 feet", "radio #3 feet")
  }

  // Merge, preserve order, remove duplicates
  const combined = [...extras, ...base]
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of combined) {
    const v = formatResponseToken(t)
    if (!seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  // If explicit BARO/RADIO examples were added, hide the generic "feet"
  const hasBaroRadio = out.some((s) => s.toLowerCase().includes("baro") || s.toLowerCase().includes("radio"))
  let filtered = out
  if (hasBaroRadio) {
    filtered = filtered.filter((s) => s.toLowerCase() !== "feet")
  }

  // If the item is a baro confirmation (or we added baro-style set examples),
  // hide the plain "set" token so pilots see only numeric-set variants like
  // "#### set" / "qnh #### set" / "altimeter #### set". Keep "set and checked".
  const hasBaroSetExample =
    filtered.some(
      (s) =>
        s.toLowerCase().includes("#### set") || s.toLowerCase().includes("qnh") || s.toLowerCase().includes("altimeter")
    ) || item.baro_confirmation === true

  if (hasBaroSetExample) {
    filtered = filtered.filter((s) => s.toLowerCase() !== "set")
  }

  // Apply final display formatting (weight units, feet) so all consumers get ready-to-display strings
  return filtered.map(renderResponseToken)
}
