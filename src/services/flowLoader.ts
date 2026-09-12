import { simvarGet } from "@/API/simvarApi"
import afterTakeoff from "@/data/flows/10_after_takeoff.json"
import climbTenThousand from "@/data/flows/11_climb_ten_thousand_flow.json"
import descTenThousand from "@/data/flows/12_desc_ten_thousand_flow.json"
import landing from "@/data/flows/13_landing.json"
import afterLanding from "@/data/flows/14_after_landing.json"
import shutdown_e1 from "@/data/flows/14a_shutdown_eng1.json"
import shutdown_e2 from "@/data/flows/14b_shutdown_eng2.json"
import parking from "@/data/flows/15_shutdown.json"
import prelimCockpitPrep from "@/data/flows/1_prelim_cockpit_prep.json"
import cockpitPrep from "@/data/flows/2_cockpit_prep.json"
import beforeStart from "@/data/flows/3_before_start.json"
import afterStart from "@/data/flows/4_after_start.json"
import afterStartE2 from "@/data/flows/4a_after_start_e2.json"
import clearLeft from "@/data/flows/5_clear_left.json"
import afterControlsCheck from "@/data/flows/6_after_flight_controls_check.json"
import beforeTakeoff from "@/data/flows/7_before_takeoff.json"
import takeoff from "@/data/flows/8_takeoff.json"
import packsOn from "@/data/flows/9_packs_on.json"
import curtains_close from "@/data/flows/curtains_close.json"
import curtains_open from "@/data/flows/curtains_open.json"
import table_close from "@/data/flows/table_close.json"
import table_open from "@/data/flows/table_open.json"
import walkaround_depart from "@/data/flows/walkaround_depart.json"
import { usePerformanceStore } from "@/store/performanceStore"
import type { Flow, FlowStep } from "@/types/flow"

export const allFlows: Flow[] = [
  prelimCockpitPrep,
  cockpitPrep,
  beforeStart,
  afterStart,
  afterStartE2,
  clearLeft,
  afterControlsCheck,
  beforeTakeoff,
  takeoff,
  packsOn,
  afterTakeoff,
  climbTenThousand,
  descTenThousand,
  landing,
  afterLanding,
  shutdown_e1,
  shutdown_e2,
  parking,
  curtains_open,
  curtains_close,
  table_open,
  table_close,
  walkaround_depart
] as Flow[]

export function getFlowById(id: string): Flow | undefined {
  return allFlows.find((f) => f.id === id)
}

async function getTemplateVars(): Promise<Record<string, string>> {
  const { takeoff, landing } = usePerformanceStore.getState()
  const vars: Record<string, string> = {}

  // TO_FLAPS_CONF mapping: 2 → flaps 1, 3 → flaps 2, 5 → flaps 3
  const TO_FLAPS_MAP: Record<number, string> = { 2: "1", 3: "2", 5: "3" }
  try {
    const toFlapsConf = await simvarGet("(L:TO_FLAPS_CONF)")
    vars["flaps"] = toFlapsConf !== null ? (TO_FLAPS_MAP[toFlapsConf] ?? "") : ""
  } catch {
    vars["flaps"] = ""
  }

  const packsOn = takeoff.packs === "on"
  const apuPacks = takeoff.packs === "apu"
  vars["pack1_cmd"] = packsOn ? "1 (>L:INI_AIR_PACK1_BUTTON)" : "0 (>L:INI_AIR_PACK1_BUTTON)"
  vars["pack2_cmd"] = packsOn ? "1 (>L:INI_AIR_PACK2_BUTTON)" : "0 (>L:INI_AIR_PACK2_BUTTON)"
  vars["pack1_expect"] = packsOn ? "1" : "0"
  vars["pack2_expect"] = packsOn ? "1" : "0"
  vars["apu_bleed_cmd"] = apuPacks ? "1 (>L:INI_AIR_BLEED_APU)" : "0 (>L:INI_AIR_BLEED_APU)"
  vars["apu_bleed_expect"] = apuPacks ? "1" : "0"

  const antiIce = takeoff.antiIce ?? "off"
  const engAntiIce = antiIce === "oneng" || antiIce === "onengwing"
  const wingAntiIce = antiIce === "onengwing"

  vars["anti_ice_eng1_cmd"] = engAntiIce ? "1 (>L:INI_ENG_ANTI_ICE1_STATE)" : "0 (>L:INI_ENG_ANTI_ICE1_STATE)"
  vars["anti_ice_eng2_cmd"] = engAntiIce ? "1 (>L:INI_ENG_ANTI_ICE2_STATE)" : "0 (>L:INI_ENG_ANTI_ICE2_STATE)"
  vars["anti_ice_wing_cmd"] = wingAntiIce ? "1 (>L:INI_WING_ANTI_ICE1_STATE)" : "0 (>L:INI_WING_ANTI_ICE1_STATE)"
  vars["anti_ice_eng1_expect"] = engAntiIce ? "1" : "0"
  vars["anti_ice_eng2_expect"] = engAntiIce ? "1" : "0"
  vars["anti_ice_wing_expect"] = wingAntiIce ? "1" : "0"

  const landingAntiIceOn = (landing.antiIce ?? "off") === "oneng"
  vars["landing_anti_ice_eng1_cmd"] = landingAntiIceOn
    ? "1 (>L:INI_ENG_ANTI_ICE1_STATE)"
    : "0 (>L:INI_ENG_ANTI_ICE1_STATE)"
  vars["landing_anti_ice_eng2_cmd"] = landingAntiIceOn
    ? "1 (>L:INI_ENG_ANTI_ICE2_STATE)"
    : "0 (>L:INI_ENG_ANTI_ICE2_STATE)"
  vars["landing_anti_ice_eng1_expect"] = landingAntiIceOn ? "1" : "0"
  vars["landing_anti_ice_eng2_expect"] = landingAntiIceOn ? "1" : "0"

  const landingApuAutoStart = (landing.apuStart ?? "auto") === "auto"
  vars["landing_apu_master_cmd"] = landingApuAutoStart ? "1 (>L:INI_APU_MASTER_SWITCH)" : "0 (>L:INI_APU_MASTER_SWITCH)"
  vars["landing_apu_master_expect"] = landingApuAutoStart ? "1" : "0"
  vars["landing_apu_start_cmd"] = landingApuAutoStart ? "1 (>L:INI_APU_START_BUTTON)" : "0 (>L:INI_APU_START_BUTTON)"
  vars["landing_apu_start_expect"] = landingApuAutoStart ? "1" : "0"

  const landingLSonoff = (landing.ls ?? false) === true
  vars["landing_ls_on"] = landingLSonoff ? "1 (>L:INI_LS_FO)" : "0 (>L:INI_LS_FO)"
  vars["landing_ls_expect"] = landingLSonoff ? "1" : "0"

  const landFlapsMap: Record<string, string> = {
    "3": "3",
    Full: "4"
  }
  vars["landing_flaps"] = landFlapsMap[landing.flaps] ?? "5"

  return vars
}

function resolveString(str: string, vars: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}

export async function resolveStep(step: FlowStep, vars?: Record<string, string>): Promise<FlowStep> {
  const templateVars = vars ?? (await getTemplateVars())
  const resolvedOnlyIf = step.only_if
    ? {
        ...step.only_if,
        ...("read" in step.only_if
          ? { read: resolveString(step.only_if.read, templateVars) }
          : { option: resolveString(step.only_if.option, templateVars) }),
        one_of: step.only_if.one_of.map((value) =>
          typeof value === "string" ? resolveString(value, templateVars) : value
        )
      }
    : undefined

  return {
    ...step,
    label: resolveString(step.label, templateVars),
    read: resolveString(step.read, templateVars),
    on: resolveString(step.on, templateVars),
    release: step.release ? resolveString(step.release, templateVars) : undefined,
    expect: typeof step.expect === "string" ? parseFloat(resolveString(step.expect, templateVars)) || 0 : step.expect,
    only_if: resolvedOnlyIf
  }
}

export async function resolveFlow(flow: Flow): Promise<Flow> {
  const vars = await getTemplateVars()
  return {
    ...flow,
    steps: await Promise.all(flow.steps.map((s) => resolveStep(s, vars)))
  }
}
