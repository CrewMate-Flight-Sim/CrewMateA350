import type { Telemetry } from "@/store/telemetryStore"

// Result for VoiceGuide UI — phrases must match CopilotSpeech grammar
export type VoiceHintPhase = {
  id: string
  title: string
  phrases: string[]
}

const N1_IDLE_MAX = 15
const TAXI_MAX_IAS = 45
const LINEUP_MAX_IAS = 60
// Level enough to count as cruise, not a climb or descent
const CRUISE_VS_LIMIT = 300
// Approach checklist is due from here on the way down
const APPROACH_PREP_ALT = 18000

function num(t: Telemetry | null, key: string): number | null {
  if (!t) return null
  const v = t[key]
  return typeof v === "number" ? v : null
}

function isOnGround(t: Telemetry | null): boolean {
  const g = num(t, "onGround")
  return g !== null && g > 0.5
}

function enginesOff(t: Telemetry | null): boolean {
  const m1 = num(t, "mixture1") ?? 1
  const m2 = num(t, "mixture2") ?? 1
  const n1 = num(t, "engine1N1") ?? 0
  const n2 = num(t, "engine2N1") ?? 0
  return m1 < 0.5 && m2 < 0.5 && n1 < N1_IDLE_MAX && n2 < N1_IDLE_MAX
}

export type ResolveVoiceHintsArgs = {
  telemetry: Telemetry | null
  lastCompletedChecklistId: string | null
  lastCompletedFlowId: string | null
  voiceChecklistRunning: boolean
  preflightTimerRunning: boolean
}

export function resolveVoiceHints(args: ResolveVoiceHintsArgs): VoiceHintPhase | null {
  const {
    telemetry: t,
    lastCompletedChecklistId: lastCl,
    lastCompletedFlowId: lastFl,
    voiceChecklistRunning,
    preflightTimerRunning
  } = args

  if (voiceChecklistRunning) return null
  if (!t) return null

  const ias = num(t, "ias") ?? 0
  const vs = num(t, "vs") ?? 0
  const alt = num(t, "alt") ?? 0
  const radioAlt = num(t, "radioAlt") ?? 0
  const flapsIndex = num(t, "flapsIndex") ?? 0
  const ground = isOnGround(t)
  const engOff = enginesOff(t)
  const transitionLevel = num(t, "transitionLevel") ?? 0
  const landingGear = num(t, "landingGear") ?? 0
  const onStandard = num(t, "baroMode") === 3
  const autopilotOn = (num(t, "autopilotEngaged") ?? 0) > 0.5

  // ── AIRBORNE ────────────────────────────────────────────────────────────────
  if (!ground) {
    const descending = vs < -300

    // Initial climb — takeoff done, flaps still out, not descending
    if (
      (lastFl === "takeoff" || lastFl === "packs_on" || lastFl === "after_takeoff") &&
      !descending &&
      flapsIndex > 0
    ) {
      const climb: string[] = []
      if (landingGear === 1) climb.push("gear up")
      climb.push("flaps X")
      if (!autopilotOn) climb.push("autopilot on")
      return {
        id: "initial_climb",
        title: "Initial climb",
        phrases: climb
      }
    }
    // Configured for landing — gear down and flaps 3 or more
    if (lastCl === "approach" && radioAlt > 5 && landingGear === 1 && flapsIndex >= 3) {
      return {
        id: "short_final1",
        title: "Short final",
        phrases: ["landing checklist", "go around flaps", "continue"]
      }
    }

    if (lastCl === "landing" && radioAlt > 5 && landingGear === 1 && flapsIndex >= 3) {
      return {
        id: "short_final2",
        title: "Short final",
        phrases: ["go around flaps", "continue"]
      }
    }

    // Approach — checklist done, still configuring
    if (lastCl === "approach" && (landingGear !== 1 || flapsIndex < 3)) {
      const config: string[] = []
      if (landingGear !== 1) config.push("gear down")
      config.push("flaps X")
      return {
        id: "approach",
        title: "Approach",
        phrases: config
      }
    }

    // Descent — chips accumulate as each item falls due
    if (descending) {
      const descent: string[] = []
      if (onStandard && transitionLevel > 0 && alt < transitionLevel) {
        descent.push("set altimeters", "set QNH")
      }
      if (lastCl !== "approach" && alt <= APPROACH_PREP_ALT) {
        descent.push("approach checklist")
      }
      if (descent.length > 0) {
        return {
          id: "descent",
          title: "Descent",
          phrases: descent
        }
      }
    }

    // Climb / cruise — phrases built from independent conditions
    const transitionAltitude = num(t, "transitionAltitude") ?? 0
    const cruising = onStandard && Math.abs(vs) < CRUISE_VS_LIMIT && alt > 10000
    const cruisePhrases: string[] = []
    if (alt > transitionAltitude && !onStandard) cruisePhrases.push("set standard")
    if (alt > 10000) cruisePhrases.push("seat belts auto")
    if (cruising) cruisePhrases.push("you have control", "i have control")

    return {
      id: "climb_cruise",
      title: "Climb / cruise",
      phrases: cruisePhrases
    }
  }

  // ── GROUND ──────────────────────────────────────────────────────────────────
  const slowGround = ias <= LINEUP_MAX_IAS

  // Parking, then securing — released once a new preflight starts
  if (lastFl === "shutdown" && !preflightTimerRunning) {
    const parked = lastCl === "parking"
    return {
      id: parked ? "securing" : "parking",
      title: parked ? "Securing" : "Parking",
      phrases: parked
        ? // securing, or straight into the next flight on a turnaround
          ["secure aircraft checklist", "lets prepare the aircraft"]
        : ["parking checklist", "cabin crew disarm slides"]
    }
  }

  // After landing
  if (lastFl === "after_landing" && ias <= TAXI_MAX_IAS) {
    return {
      id: "after_landing_hints",
      title: "After landing",
      phrases: ["shutdown engine X", "taxi light off"]
    }
  }

  // Takeoff — FMA readout while slow, the reject call for the whole roll
  if (lastFl === "takeoff") {
    const takeoff: string[] = []
    if (slowGround) {
      takeoff.push("man flex XX srs runway autothrust blue", "man toga srs autothrust blue")
    }
    takeoff.push("stop")
    return {
      id: "takeoff_thrust",
      title: "Takeoff",
      phrases: takeoff
    }
  }

  // Takeoff — line up checklist done
  if (lastCl === "line_up" && slowGround) {
    return {
      id: "call_takeoff",
      title: "Takeoff",
      phrases: ["takeoff"]
    }
  }

  // Line up — before takeoff flow done
  if (lastFl === "before_takeoff" && slowGround) {
    return {
      id: "call_lineup_checklist",
      title: "Line up",
      phrases: ["lineup checklist"]
    }
  }

  // Before takeoff — taxi checklist done
  if (lastCl === "taxi" && slowGround) {
    return {
      id: "before_to_proc",
      title: "Before takeoff",
      phrases: ["clear to line up", "runway entry procedure"]
    }
  }

  // Flight controls checked — after start checklist is next
  if (lastFl === "after_flight_controls_check" && lastCl !== "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "after_start_checklist",
      title: "After start",
      phrases: ["after start checklist"]
    }
  }

  // Taxi — clear left done
  if (lastFl === "clear_left" && ias <= TAXI_MAX_IAS) {
    return {
      id: "post_clear_left",
      title: "Taxi",
      phrases: ["flight controls check", "taxi light on"]
    }
  }

  // Taxi — after start checklist done
  if (lastCl === "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "taxi_phase",
      title: "Taxi",
      phrases: ["clear left"]
    }
  }

  // After start — flow done, flight controls check is next
  if (lastFl === "after_start" && lastCl !== "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "after_start_running",
      title: "After start",
      phrases: ["flight controls check"]
    }
  }

  // Engine start — before start checklist done
  if (lastCl === "before_start" && lastFl !== "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "engine_start",
      title: "Engine start",
      phrases: ["starting engine X", "starting number X"]
    }
  }

  // Ready for before start — flow done, checklist not called yet
  if (lastFl === "before_start" && lastCl !== "before_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "call_before_start_checklist",
      title: "Ready for before start",
      phrases: ["before start checklist", "cabin crew arm slides"]
    }
  }

  // Before start — cockpit preparation checklist done
  if (lastCl === "cockpit_preparation") {
    return {
      id: "post_cockpit_prep",
      title: "Before start",
      phrases: ["before start procedure", "start the apu"]
    }
  }

  // ── Engines off ─────────────────────────────────────────────────────────────

  // Preflight timer running, engines off
  if (preflightTimerRunning && engOff) {
    return {
      id: "prep_timeline",
      title: "Prepare",
      phrases: ["cockpit preparation checklist", "start the apu"]
    }
  }

  // Cold and dark, no timeline
  if (engOff) {
    return {
      id: "prep",
      title: "Prepare",
      phrases: ["lets prepare the aircraft", "lets prepare the flight", "lets set up the aircraft"]
    }
  }

  return null
}
