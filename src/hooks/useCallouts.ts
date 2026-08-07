import { useEffect, useRef, useCallback } from "react"

import { simvarSet } from "@/API/simvarApi"
import { startPostLandingTimer } from "@/services/flowRunner"
import { playSound, isSoundPlaying } from "@/services/playSounds"
import { useGoAroundStore } from "@/store/goAroundStore"
import { usePassingAltitudeStore } from "@/store/passingAltitudeStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"

type LandingPhase = "idle" | "spoilers" | "reverser" | "decel"

interface SpeedCalloutFlags {
  calledThrustSet: boolean
  called100: boolean
  called70: boolean
  calledVr: boolean
  vrInhibit: boolean
}

interface AltitudeCalloutFlags {
  positiveClimb: boolean
  tenThousandClimb: boolean
  tenThousandDescent: boolean
  transitionAltitude: boolean
  transitionLevel: boolean
  oneToGo: boolean
}

interface LandingSequenceState {
  wasAirborne: boolean
  phase: LandingPhase
  phaseStartTime: number | null
  done: boolean
}

interface PreviousValues {
  speed: number
  alt: number
  onGround: number
  cabinIsReady: number
  takeoffN1: number
  fcuAlt: number
}

const THRUST_SET_MARGIN = 3

const getTakeoffThrustTarget = (t: Telemetry) => {
  if ((t.iniFlexTemperature ?? 0) > 1) {
    return t.iniThrustFlexN1 ?? 0
  }

  return t.iniThrustTogaN1 ?? 0
}

const crossedUp = (prev: number, curr: number, threshold: number) => prev < threshold && curr >= threshold

const crossedDown = (prev: number, curr: number, threshold: number) => prev > threshold && curr <= threshold

/**
 * Build audio sequence for "standard crosschecked, passing FL XXX"
 * @param targetAlt Target altitude in feet
 * @returns Array of audio filenames to play in sequence
 */
export const buildPassingAltitudeSequence = (targetAlt: number): string[] => {
  const sequence: string[] = ["standard_cross_checked.ogg", "passing_flight_level.ogg"]

  const flightLevel = Math.round(targetAlt / 100)
  //  FL050, FL100, FL250, etc.
  const flString = flightLevel.toString().padStart(3, "0")

  // digit files
  for (const digit of flString) {
    sequence.push(`${digit}.ogg`)
  }

  return sequence
}

const advancePhase = (ls: LandingSequenceState, next: LandingPhase, now: number) => {
  ls.phase = next
  ls.phaseStartTime = now
}

const completeLanding = (ls: LandingSequenceState) => {
  ls.phase = "idle"
  ls.phaseStartTime = null
  ls.done = true
}

const resetLanding = (ls: LandingSequenceState) => {
  ls.phase = "idle"
  ls.phaseStartTime = null
  ls.done = false
}

// ─── Landing phase handlers ──────────────────────────────────────────────────

const SPOILER_TIMEOUT = 3000
const REVERSER_TIMEOUT = 3000
const DECEL_TIMEOUT = 10000

function handleSpoilersPhase(ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) {
  if (t.spoilersHandlePosition > 0.1) {
    playSound("spoilers.ogg")
    advancePhase(ls, "reverser", now)
  } else if (elapsed >= SPOILER_TIMEOUT) {
    playSound("no_spoilers.ogg")
    advancePhase(ls, "reverser", now)
  }
}

function handleReverserPhase(ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) {
  if (t.throttleLever1 < -0.1 || t.throttleLever2 < -0.1) {
    playSound("reverse_green.ogg")
    advancePhase(ls, "decel", now)
  } else if (elapsed >= REVERSER_TIMEOUT) {
    playSound("no_reverse_engine_1_and_2.ogg")
    advancePhase(ls, "decel", now)
  }
}

function handleDecelPhase(ls: LandingSequenceState, t: Telemetry, elapsed: number) {
  const brakesApplied = t.brakeLeftPosition > 0.1 || t.brakeRightPosition > 0.1
  if (brakesApplied && t.ias > 40) {
    playSound("decel.ogg")
    completeLanding(ls)
  } else if (elapsed >= DECEL_TIMEOUT) {
    completeLanding(ls)
  }
}

const phaseHandlers: Record<
  Exclude<LandingPhase, "idle">,
  (ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) => void
> = {
  spoilers: handleSpoilersPhase,
  reverser: handleReverserPhase,
  decel: handleDecelPhase
}

export function useCallouts(vrSpeed: number) {
  const speed = useRef<SpeedCalloutFlags>({
    calledThrustSet: false,
    called100: false,
    called70: false,
    calledVr: false,
    vrInhibit: true
  })

  const altitude = useRef<AltitudeCalloutFlags>({
    positiveClimb: false,
    tenThousandClimb: false,
    tenThousandDescent: false,
    transitionAltitude: false,
    transitionLevel: false,
    oneToGo: false
  })

  const landing = useRef<LandingSequenceState>({
    wasAirborne: false,
    phase: "idle",
    phaseStartTime: null,
    done: false
  })

  const prev = useRef<PreviousValues>({
    speed: 0,
    alt: 0,
    onGround: 1,
    cabinIsReady: 0,
    takeoffN1: 0,
    fcuAlt: 0
  })

  const cabinReadyPrimed = useRef(false)
  const thrustSetPrimed = useRef(false)

  const vrSpeedRef = useRef(vrSpeed)
  vrSpeedRef.current = vrSpeed

  // Re-arm positive-climb callout on go-around
  const goAroundCount = useRef(useGoAroundStore.getState().count)
  useEffect(() => {
    return useGoAroundStore.subscribe((s) => {
      if (s.count !== goAroundCount.current) {
        goAroundCount.current = s.count
        altitude.current.positiveClimb = false
      }
    })
  }, [])

  const tick = useCallback(async () => {
    const t = useTelemetryStore.getState().telemetry
    if (!t || t.isSlewActive) return

    const sp = speed.current
    const al = altitude.current
    const ls = landing.current
    const p = prev.current
    const vr = vrSpeedRef.current
    const now = Date.now()
    const cabinIsReady = (t.cabinIsReady ?? 0) > 0.5 ? 1 : 0
    const takeoffN1 = Math.min(t.engineN1_1 ?? 0, t.engineN1_2 ?? 0)
    const fcuAlt = t.fcu_alt ?? 0
    const takeoffThrustTarget = getTakeoffThrustTarget(t)

    if (!cabinReadyPrimed.current) {
      cabinReadyPrimed.current = true
      p.cabinIsReady = cabinIsReady
    }

    if (!thrustSetPrimed.current) {
      thrustSetPrimed.current = true
      p.takeoffN1 = takeoffN1
    }

    // Re-arm one-to-go when FCU altitude changes
    if (fcuAlt !== p.fcuAlt) {
      al.oneToGo = false
    }

    // Takeoff / landing edge detection
    if (!t.onGround && p.onGround) {
      sp.called100 = false
      sp.vrInhibit = true
      al.positiveClimb = false
      al.tenThousandClimb = false
      al.transitionAltitude = false
      al.oneToGo = false
    }

    if (t.onGround && !p.onGround) {
      sp.called70 = false
      sp.vrInhibit = true
      al.tenThousandDescent = false
      al.transitionLevel = false
      al.oneToGo = false
    }

    // Speed callouts (ground)
    if (t.onGround && !sp.vrInhibit && vr && !isNaN(vr) && t.ias >= vr && t.ias < vr + 5 && !sp.calledVr) {
      playSound("rotate.ogg")
      sp.calledVr = true
      sp.vrInhibit = true
    }

    // 100 knots callout
    if (t.onGround && crossedUp(p.speed, t.ias, 100) && !sp.called100) {
      playSound("100_knots.ogg")
      sp.called100 = true
    }

    // 70 knots callout
    if (t.onGround && crossedDown(p.speed, t.ias, 70) && !sp.called70) {
      playSound("70_knots.ogg")
      sp.called70 = true
      // 2 seconds after the 70-knot callout, press the chrono button and start the
      // post-landing timer. The chrono counts up in seconds; when it reaches 300
      // (5 minutes) the announcement plays.
      setTimeout(() => {
        if (useSettingsStore.getState().postLandingShutdownEnabled) {
          void simvarSet("1 (>L:INI_FO_CHRONO_BUTTON)")
          startPostLandingTimer()
        }
      }, 3000)
    }

    // Thrust set callout
    if (
      t.onGround &&
      t.ias < 80 &&
      takeoffThrustTarget > 0 &&
      p.takeoffN1 < takeoffThrustTarget - THRUST_SET_MARGIN &&
      takeoffN1 >= takeoffThrustTarget - THRUST_SET_MARGIN &&
      !sp.calledThrustSet
    ) {
      playSound("thrust_set.ogg")
      sp.calledThrustSet = true
    }

    // Cabin ready
    if (t.onGround && p.cabinIsReady === 0 && cabinIsReady === 1) {
      playSound("cabin_ready.ogg")
    }

    // Positive climb
    if (!t.onGround && t.vs > 120 && t.radioAlt > 30 && !al.positiveClimb) {
      playSound("positive_climb.ogg")
      al.positiveClimb = true
    }

    // Ten thousand feet
    if (!t.onGround && t.vs > 100 && !al.tenThousandClimb && crossedUp(p.alt, t.alt, 10000)) {
      playSound(t.transitionAltitude < 10000 ? "fl_100.ogg" : "ten_thousand.ogg")
      al.tenThousandClimb = true
    }

    if (!t.onGround && t.vs < -100 && !al.tenThousandDescent && crossedDown(p.alt, t.alt, 10000)) {
      playSound(t.transitionLevel < 10000 ? "fl_100.ogg" : "ten_thousand.ogg")
      al.tenThousandDescent = true
    }

    // One to go
    if (!t.onGround && t.vs > 100 && !al.oneToGo && fcuAlt > 0 && crossedUp(p.alt, t.alt, fcuAlt - 1000)) {
      playSound("one_to_go.ogg")
      al.oneToGo = true
    }

    if (!t.onGround && t.vs < -100 && !al.oneToGo && fcuAlt > 0 && crossedDown(p.alt, t.alt, fcuAlt + 1000)) {
      playSound("one_to_go.ogg")
      al.oneToGo = true
    }

    // Transition altitude / level
    if (
      !t.onGround &&
      t.vs > 100 &&
      !al.transitionAltitude &&
      t.transitionAltitude > 0 &&
      crossedUp(p.alt, t.alt, t.transitionAltitude)
    ) {
      playSound("transiton_altitude.ogg")
      al.transitionAltitude = true
    }

    if (
      !t.onGround &&
      t.vs < -100 &&
      !al.transitionLevel &&
      t.transitionLevel > 0 &&
      crossedDown(p.alt, t.alt, t.transitionLevel)
    ) {
      playSound("transiton_level.ogg")
      al.transitionLevel = true
    }

    // Passing altitude "now" callout
    const passingAltStore = usePassingAltitudeStore.getState()
    if (passingAltStore.targetAltitude !== null && !passingAltStore.hasCalled) {
      // Check BOTH indicated and pressure altitude (use whichever is higher after setting standard)
      const altReached = t.alt >= passingAltStore.targetAltitude
      const pAltReached = t.pAlt >= passingAltStore.targetAltitude

      if (altReached || pAltReached) {
        playSound("now_at.ogg")
        passingAltStore.markCalled()
        // Clear state
        setTimeout(() => {
          passingAltStore.reset()
        }, 500)
      }
    }

    // Re-arm at taxi speed
    if (t.onGround && t.ias < 30) {
      sp.calledThrustSet = false
      sp.calledVr = false
      sp.called100 = false
      sp.vrInhibit = false
      // Reset passing altitude state
      usePassingAltitudeStore.getState().reset()
    }

    // Landing sequence

    // Track sustained airborne (vs > 200 filters ground bounces)
    if (!t.onGround && t.vs > 200) {
      ls.wasAirborne = true
    }

    // Arm: landing (was airborne → now on ground)
    if (t.onGround && ls.wasAirborne && ls.phase === "idle" && !ls.done) {
      advancePhase(ls, "spoilers", now)
      ls.wasAirborne = false
    }

    // Arm: RTO (never airborne, spoilers deployed at speed)
    if (
      t.onGround &&
      !ls.wasAirborne &&
      ls.phase === "idle" &&
      !ls.done &&
      t.spoilersHandlePosition > 0.1 &&
      t.ias > 60
    ) {
      advancePhase(ls, "spoilers", now)
    }

    // Reset on sustained climb-away
    if (!t.onGround && t.vs > 500) {
      // Only reset passing altitude on actual go-around (landing sequence was active)
      if (ls.phase !== "idle" || ls.done) {
        usePassingAltitudeStore.getState().reset()
      }
      resetLanding(ls)
      ls.wasAirborne = false
    }

    // Reset on taxi
    if (t.onGround && t.ias < 30) {
      resetLanding(ls)
    }

    // Process landing phases (skip if idle or audio still playing)
    if (ls.phase !== "idle" && !(await isSoundPlaying())) {
      const elapsed = ls.phaseStartTime ? now - ls.phaseStartTime : 0
      const handler = (phaseHandlers as Record<string, (...args: unknown[]) => unknown>)[ls.phase]
      if (typeof handler === "function") {
        handler(ls, t, elapsed, now)
      } else {
        console.warn(`[useCallouts] Unknown landing phase: ${ls.phase}`)
        // Reset landing sequence to avoid repeated errors
        resetLanding(ls)
      }
    }

    // Update previous values
    p.speed = t.ias
    p.alt = t.alt
    p.onGround = t.onGround
    p.cabinIsReady = cabinIsReady
    p.takeoffN1 = takeoffN1
    p.fcuAlt = fcuAlt
  }, [])

  useEffect(() => {
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [tick])
}
