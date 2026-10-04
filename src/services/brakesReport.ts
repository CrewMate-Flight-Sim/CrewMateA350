import { simvarGet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { playSound, playSoundSequence } from "@/services/playSounds"

// The EFB maintenance page turns red at these values
const TYRE_WORN = 160
const BRAKE_WORN = 0.7

const NOSE_TYRES = ["INI_TIRE0_NG_WEAR", "INI_TIRE1_NG_WEAR"]
const LEFT_TYRES = [
  "INI_TIRE6_WEAR",
  "INI_TIRE7_WEAR",
  "INI_TIRE8_WEAR",
  "INI_TIRE9_WEAR",
  "INI_TIRE10_WEAR",
  "INI_TIRE11_WEAR"
]
const RIGHT_TYRES = [
  "INI_TIRE0_WEAR",
  "INI_TIRE1_WEAR",
  "INI_TIRE2_WEAR",
  "INI_TIRE3_WEAR",
  "INI_TIRE4_WEAR",
  "INI_TIRE5_WEAR"
]
const LEFT_BRAKES = ["LFI", "LFO", "LRI", "LRO"].map((pos) => `INI_Brake_Wear_Indicator_${pos}`)
const RIGHT_BRAKES = ["RFI", "RFO", "RRI", "RRO"].map((pos) => `INI_Brake_Wear_Indicator_${pos}`)

// Walkaround order: nose gear, then left main, then right main
const CHECKS: { lvars: string[]; limit: number; sound: string }[] = [
  { lvars: NOSE_TYRES, limit: TYRE_WORN, sound: "nose_tyre_worn.ogg" },
  { lvars: LEFT_TYRES, limit: TYRE_WORN, sound: "left_tyre_worn.ogg" },
  { lvars: LEFT_BRAKES, limit: BRAKE_WORN, sound: "left_brakes_worn.ogg" },
  { lvars: RIGHT_TYRES, limit: TYRE_WORN, sound: "right_tyre_worn.ogg" },
  { lvars: RIGHT_BRAKES, limit: BRAKE_WORN, sound: "right_brakes_worn.ogg" }
]

const REREAD_DELAY_MS = 300

async function readWear(lvars: string[]): Promise<(number | null)[]> {
  const read = () => Promise.all(lvars.map((name) => simvarGet(`(L:${name})`).catch(() => null)))
  const first = await read()
  if (!first.includes(null)) return first
  // The first read of a variable only registers it and comes back empty
  await delay(REREAD_DELAY_MS)
  return read()
}

/** The FO's walkaround report at T-35: all good, or each worn gear and a call for maintenance. */
export async function reportBrakesAndTyres(): Promise<void> {
  const findings: string[] = []
  for (const check of CHECKS) {
    const values = await readWear(check.lvars)
    if (values.some((value) => value !== null && value >= check.limit)) {
      findings.push(check.sound)
    }
  }

  if (findings.length === 0) {
    await playSound("walkaround_completed.ogg")
    return
  }

  console.log(`[BrakesReport] Worn: ${findings.join(", ")}`)
  await playSoundSequence(["walkaround_findings.ogg", ...findings, "need_maintenance.ogg"])
}
