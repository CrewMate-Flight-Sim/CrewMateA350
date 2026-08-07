import { simvarSet } from "@/API/simvarApi"
import { buildPassingAltitudeSequence } from "@/hooks/useCallouts"
import { delay } from "@/lib/utils"
import { abortChecklist, executeChecklist } from "@/services/checklistRunner"
import { executeFlow } from "@/services/flowRunner"
import { playSound, playSoundSequence } from "@/services/playSounds"
import { useGroundEngineerStore } from "@/store/groundEngineerStore"
import { usePassingAltitudeStore } from "@/store/passingAltitudeStore"
import { usePerformanceStore } from "@/store/performanceStore"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"

import { setEngAntiIce, setWingAntiIce } from "./commands/anti_ice"
import { setStartAPU } from "./commands/apu"
import {
  setAirspeedDial,
  setAltitudeDial,
  setAPPR,
  setAutoPilot,
  setBird,
  setFlightDirector,
  setHeadingDial,
  setLOC,
  setLevelOff,
  setManagedAlt,
  setManagedHeading,
  setManagedSpeed,
  setSelAlt,
  setSelHeading,
  setSelSpeed
} from "./commands/autoPilot"
import { setStdBaro } from "./commands/baro"
import { setDoorSlides } from "./commands/doorSlides"
import { setIgnKnob, startEngine2 } from "./commands/engine"
import { setFlaps } from "./commands/flaps"
import { flightControlsCheck } from "./commands/flight_controls_check"
import { setGearHandle } from "./commands/gear"
import { executeGoAround } from "./commands/goAround"
import { callPushback, disconnectAllGround, setACU, setASU, setGPU } from "./commands/groundServices"
import { setLandingLights, setStrobeLights, setTaxiLights } from "./commands/lights"
import { setSeatBelts } from "./commands/seat_belts"
import { setWipers } from "./commands/wipers"

const randomDelay = (min: number, max: number) => delay(min + Math.random() * (max - min))

const gePack = () => useSettingsStore.getState().geSoundPack

// Commands that are allowed to fire even while a checklist is running.
export const checklistAbortCommands = new Set(["checklist_cancel"])

// ─── Discrete command map ─────────────────────────────────────────────────────

export const discreteCommandMap: Record<string, () => void | Promise<void>> = {
  // ── Gear ──────────────────────────────────────────────────────────────────
  gear_up: () => setGearHandle(0),
  gear_down: () => setGearHandle(1),

  // ── Flaps ─────────────────────────────────────────────────────────────────
  flaps_0: () => setFlaps(0),
  flaps_1: () => setFlaps(1),
  flaps_2: () => setFlaps(2),
  flaps_3: () => setFlaps(3),
  flaps_full: () => setFlaps(4),
  go_around_flaps: () => executeGoAround(),

  // ── Lights ────────────────────────────────────────────────────────────────
  landing_lights_on: () => {
    playSound("check.ogg")
    setLandingLights(1)
  },
  landing_lights_off: () => {
    playSound("check.ogg")
    setLandingLights(0)
  },
  takeoff_lights_on: () => {
    playSound("check.ogg")
    setTaxiLights(0)
  },
  taxi_lights_on: () => {
    playSound("check.ogg")
    setTaxiLights(1)
  },
  taxi_lights_off: () => {
    playSound("check.ogg")
    setTaxiLights(2)
  },
  strobe_lights_on: () => {
    playSound("check.ogg")
    setStrobeLights(0)
  },
  strobe_lights_auto: () => {
    playSound("check.ogg")
    setStrobeLights(1)
  },
  strobe_lights_off: () => {
    playSound("check.ogg")
    setStrobeLights(2)
  },

  // ── Flight director & bird ────────────────────────────────────────────────
  flight_director_on: () => {
    playSound("check.ogg")
    setFlightDirector(1)
  },
  flight_director_off: () => {
    playSound("check.ogg")
    setFlightDirector(0)
  },
  flight_director_off_bird_on: async () => {
    playSound("check.ogg")
    await setFlightDirector(0)
    await setBird(1)
  },
  bird_on: () => {
    playSound("check.ogg")
    setBird(1)
  },
  bird_off: () => {
    playSound("check.ogg")
    setBird(0)
  },

  // ── Autopilot  ──────────────────────────────────────────────
  autopilot_engage: () => {
    playSound("check.ogg")
    setAutoPilot(1)
  },
  autopilot_disconnect: () => setAutoPilot(0),

  // ── FCU knob commands ──────────────────────────────
  pull_heading: () => {
    playSound("check.ogg")
    setSelHeading(1)
  },
  manage_nav: () => {
    playSound("check.ogg")
    setManagedHeading(1)
  },
  pull_altitude: () => {
    playSound("check.ogg")
    setSelAlt(1)
  },
  manage_altitude: () => {
    playSound("check.ogg")
    setManagedAlt(1)
  },
  pull_speed: () => {
    playSound("check.ogg")
    setSelSpeed(1)
  },
  manage_speed: () => {
    playSound("check.ogg")
    setManagedSpeed(1)
  },
  push_to_level_off: () => {
    playSound("check.ogg")
    setLevelOff(1)
  },
  arm_approach: () => {
    playSound("check.ogg")
    setAPPR(1)
  },
  arm_localizer: () => {
    playSound("check.ogg")
    setLOC(1)
  },
  set_runway_track: () => {
    const hdg = useTelemetryStore.getState().telemetry?.["landingtrk"]
    if (hdg != null) {
      playSound("check.ogg")
      setHeadingDial(hdg)
    }
  },

  // ── Baro ──────────────────────────────────────────────────────────────────
  set_standard: () => {
    const t = useTelemetryStore.getState().telemetry
    const passingAlt = usePassingAltitudeStore.getState()

    setStdBaro(3)

    // Only trigger passing altitude callout if:
    // - Airborne
    // - Climbing (VS > 100 fpm)
    // - Not already tracking a passing altitude
    if (t && !t.onGround && t.vs > 100 && !passingAlt.isTracking()) {
      const targetAlt = t.pAlt + t.vs * (9 / 60)

      // Play "standard crosschecked, passing FL XXX" sequence
      const sequence = buildPassingAltitudeSequence(targetAlt)
      playSoundSequence(sequence)

      // Store target for "now" callout detection
      passingAlt.setTarget(targetAlt)
    }
  }, // might need a look, it breaks when you want to preset

  set_altimeter: async () => {
    playSound("check.ogg")
    await setStdBaro(0)
    await delay(500)
    await simvarSet("(>K:BAROMETRIC)")
  },

  // ── APU and Engine ───────────────────────────────────────────────────────────────────
  apu_start: () => {
    playSound("check.ogg")
    setStartAPU(1)
  },
  start_engine_2: async () => {
    playSound("check.ogg")
    setIgnKnob(2)
    playSound("starting_engine_2.ogg")
    await delay(4000)
    startEngine2(1)
  },

  // ── Anti-ice ──────────────────────────────────────────────────────────────
  engine_anti_ice_on: () => {
    playSound("check.ogg")
    setEngAntiIce(1)
  },
  engine_anti_ice_off: () => {
    playSound("check.ogg")
    setEngAntiIce(0)
  },
  wing_anti_ice_on: () => {
    playSound("check.ogg")
    setWingAntiIce(1)
  },
  wing_anti_ice_off: () => {
    playSound("check.ogg")
    setWingAntiIce(0)
  },

  // ── Seat belts ────────────────────────────────────────────────────────────
  seat_belts_on: () => {
    playSound("check.ogg")
    setSeatBelts(0)
  },
  seat_belts_off: () => {
    playSound("check.ogg")
    setSeatBelts(2)
  },
  seat_belts_auto: () => {
    playSound("check.ogg")
    setSeatBelts(1)
  },

  // ── Wipers ────────────────────────────────────────────────────────────────
  wipers_off: () => setWipers(3),
  wipers_slow: () => setWipers(4),
  wipers_fast: () => setWipers(5),
  wipers_slow_intermittent: () => setWipers(0),
  wipers_medium_intermittent: () => setWipers(1),
  wipers_fast_intermittent: () => setWipers(2),

  // ── Cabin crew / doors ────────────────────────────────────────────────────
  cabin_crew_arm_slides: () => setDoorSlides(true),
  cabin_crew_disarm_slides: () => setDoorSlides(false),

  // ── Brake check ───────────────────────────────────────────────────────────
  brake_check: () => playSound("pressure_zero.ogg"),

  // ── Flight controls ───────────────────────────────────────────────────────
  flight_controls_check: async () => {
    await playSound("ready.ogg")
    await flightControlsCheck()
  },

  // ── Preflight timer ───────────────────────────────────────────────────────
  prepare_aircraft: () => usePreflightTimerStore.getState().start(),

  // ── Engine start ──────────────────────────────────────────────────────────
  engine_start_1: () => playSound("check.ogg"),
  engine_start_2: () => playSound("check.ogg"),

  // ── Flows ─────────────────────────────────────────────────────────────────
  clear_left: () => executeFlow("clear_left"),
  before_start: () => executeFlow("before_start"),
  runway_entry_procedure: () => executeFlow("before_takeoff"),
  shutdown_engine_1: () => executeFlow("shutdown_eng1"),
  shutdown_engine_2: () => executeFlow("shutdown_eng2"),
  clear_for_takeoff: () => executeFlow("takeoff"),

  // ── Checklists ────────────────────────────────────────────────────────────
  checklist_cockpit_preparation: () => executeChecklist("cockpit_preparation"),
  checklist_departure_change: () => executeChecklist("departure_change"),
  checklist_before_start: () => executeChecklist("before_start"),
  checklist_after_start: () => executeChecklist("after_start"),
  checklist_taxi: () => executeChecklist("taxi"),
  checklist_lineup: () => executeChecklist("line_up"),
  checklist_approach: () => executeChecklist("approach"),
  checklist_landing: () => executeChecklist("landing"),
  checklist_parking: () => executeChecklist("parking"),
  checklist_secure_aircraft: () => executeChecklist("secure_aircraft"),
  checklist_cancel: () => abortChecklist(),

  // ── RTO / Continue  ─────────────────────────────────────
  //abort_takeoff: () => playSound("check.ogg"),
  continue: () => playSound("check.ogg"),

  // ── Ground engineer ───────────────────────────────────────────────────────
  pushback_request: async () => {
    await callPushback()
  },
  ground_call: async () => {
    await randomDelay(2000, 6000)
    await playSound("go_ahead.ogg", { pack: gePack() })
    useGroundEngineerStore.getState().activate()
  },
  connect_gpu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setGPU(true)
    await playSound("gpu_on.ogg", { pack: gePack() })
  },
  disconnect_gpu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setGPU(false)
    await playSound("gpu_off.ogg", { pack: gePack() })
  },
  connect_asu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setASU(true)
    await playSound("asu_on.ogg", { pack: gePack() })
  },
  disconnect_asu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setASU(false)
    await playSound("asu_off.ogg", { pack: gePack() })
  },
  connect_acu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setACU(true)
    await playSound("acu_on.ogg", { pack: gePack() })
  },
  disconnect_acu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setACU(false)
    await playSound("acu_off.ogg", { pack: gePack() })
  },
  disconnect_all_ground: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(5000, 12000)
    await disconnectAllGround()
    await playSound("gpu_off.ogg", { pack: gePack() })
  }
}

// ─── FO command dispatcher (heading, altitude, speed, fma) ────────

export async function dispatchFoCommand(commandType: string, payload: Record<string, unknown>): Promise<boolean> {
  const verb = (payload.verb as string | undefined) ?? "set"
  const isPull = verb === "pull"
  const isMng = verb === "manage"

  switch (commandType) {
    case "discrete": {
      const cmd = payload.command as string | undefined
      if (!cmd) return false
      const handler = discreteCommandMap[cmd]
      if (handler) await handler()
      return true
    }

    case "heading": {
      const value = payload.value as number
      if (isPull) {
        setSelHeading(1)
        await delay(500)
      }
      setHeadingDial(value)
      return true
    }

    case "altitude": {
      playSound("check.ogg")
      const feet = payload.flightLevel != null ? (payload.flightLevel as number) * 100 : (payload.value as number)
      setAltitudeDial(feet)
      await delay(200)
      if (isPull) {
        setSelAlt(1)
      } else if (isMng) {
        setManagedAlt(1)
      }
      return true
    }

    case "speed": {
      const value = payload.value as number
      if (isPull) {
        setSelSpeed(1)
        await delay(500)
      }
      setAirspeedDial(value)
      return true
    }

    case "fma_callout": {
      playSound("check.ogg")
      return true
    }

    case "missed_approach_altitude": {
      if ((payload.mode as string) === "auto") {
        const alt = usePerformanceStore.getState().landing?.["missedAltitude"]
        if (alt != null) {
          playSound("missed_approach_alt_set.ogg")
          setAltitudeDial(alt)
        }
      } else if (payload.value != null) {
        playSound("missed_approach_alt_set.ogg")
        setAltitudeDial(payload.value as number)
      }
      return true
    }

    default:
      return false
  }
}
