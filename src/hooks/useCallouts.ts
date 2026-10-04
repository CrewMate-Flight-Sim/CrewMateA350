import { useEffect, useRef } from "react"

import { simvarSet } from "@/API/simvarApi"
import { useTelemetryTick } from "@/hooks/useTelemetryTick"
import { playSound, isSoundPlaying } from "@/services/playSounds"
import { useGoAroundStore } from "@/store/goAroundStore"
import { usePassingAltitudeStore } from "@/store/passingAltitudeStore"
import { useRtoStore } from "@/store/rtoStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"

type LandingPhase = "idle" | "spoilers" | "reverser" | "autobrake" | "decel"

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

interface RtoState {
  active: boolean
  startedAt: number | null
  calledReverse: boolean
  calledDecel: boolean
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

// Idle reverse reads -0.055 and forward idle +0.016, so this sits between them
const REVERSE_LEVER_THRESHOLD = -0.02

const isReverseSelected = (t: Telemetry) =>
  t.throttleLever1 < REVERSE_LEVER_THRESHOLD || t.throttleLever2 < REVERSE_LEVER_THRESHOLD

const crossedUp = (prev: number, curr: number, threshold: number) => prev < threshold && curr >= threshold

const crossedDown = (prev: number, curr: number, threshold: number) => prev > threshold && curr <= threshold

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
  if (isReverseSelected(t)) {
    playSound("reverse_green.ogg")
    advancePhase(ls, "autobrake", now)
  } else if (elapsed >= REVERSER_TIMEOUT) {
    playSound("no_reverse_engine_1_and_2.ogg")
    advancePhase(ls, "autobrake", now)
  }
}

// FCOM PRO-NOR-SOP-210: the PM announces the autobrake mode on the FMA between REVERSE GREEN and DECEL
const AUTOBRAKE_BTV = 1
const AUTOBRAKE_MED = 3

function handleAutobrakePhase(ls: LandingSequenceState, t: Telemetry, _elapsed: number, now: number) {
  if (t.autobrakeLevel === AUTOBRAKE_BTV) playSound("BTV.ogg")
  else if (t.autobrakeLevel === AUTOBRAKE_MED) playSound("brake_med.ogg")
  advancePhase(ls, "decel", now)
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

const PHASE_HANDLERS: Record<
  Exclude<LandingPhase, "idle">,
  (ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) => void
> = {
  spoilers: handleSpoilersPhase,
  reverser: handleReverserPhase,
  autobrake: handleAutobrakePhase,
  decel: handleDecelPhase
}

// ─── Rejected takeoff ────────────────────────────────────────────────────────
// FCOM PRO-ABN-ABN-00: REVERSE GREEN, then DECEL or NO DECEL; no spoilers call, and nothing about a reverse never selected

const RTO_ARM_MIN_IAS = 40
const RTO_END_IAS = 30
const RTO_DECEL_TIMEOUT = 5000

const resetRto = (rto: RtoState) => {
  rto.active = false
  rto.startedAt = null
  rto.calledReverse = false
  rto.calledDecel = false
}

function handleRto(rto: RtoState, t: Telemetry, prevSpeed: number, now: number) {
  if (!rto.calledReverse && isReverseSelected(t)) {
    playSound("reverse_green.ogg")
    rto.calledReverse = true
    return
  }

  if (rto.calledDecel) return

  const brakesApplied = t.brakeLeftPosition > 0.1 || t.brakeRightPosition > 0.1
  const elapsed = rto.startedAt ? now - rto.startedAt : 0

  if (brakesApplied && t.ias < prevSpeed) {
    playSound("decel.ogg")
    rto.calledDecel = true
  } else if (elapsed >= RTO_DECEL_TIMEOUT) {
    playSound("no_decel.ogg")
    rto.calledDecel = true
  }
}

// ─── Approach deviation calls ────────────────────────────────────────────────
// FCOM PRO-NOR-SCO "Flight parameters, approach"; re-armed at most every 5 s so a value on the limit doesn't chatter

type DeviationCall = "speed" | "sinkRate" | "bank" | "pitch" | "loc" | "glide"

const DEVIATION_MIN_RA = 50
const DEVIATION_MAX_RA = 1000
const DEVIATION_REARM_MS = 5000
const DOTS_LIMIT = 0.5

const DEVIATION_SOUNDS: Record<DeviationCall, string> = {
  speed: "speed.ogg",
  sinkRate: "sink_rate.ogg",
  bank: "bank.ogg",
  pitch: "pitch.ogg",
  loc: "loc.ogg",
  glide: "glide.ogg"
}

function exceededDeviations(t: Telemetry): Record<DeviationCall, boolean> {
  // The sim reports nose up as negative pitch
  const pitchUp = -t.pitchDegrees
  const lsValid = t.locValid > 0.5
  return {
    speed: t.speedTarget > 0 && (t.ias < t.speedTarget - 5 || t.ias > t.speedTarget + 10),
    sinkRate: t.vs < -1000,
    bank: Math.abs(t.bankDegrees) > 6,
    pitch: pitchUp > 10 || pitchUp < 0,
    loc: lsValid && Math.abs(t.locDeviation) > DOTS_LIMIT,
    glide: lsValid && Math.abs(t.glideDeviation) > DOTS_LIMIT
  }
}

const newDeviationState = (): Record<DeviationCall, number | null> => ({
  speed: null,
  sinkRate: null,
  bank: null,
  pitch: null,
  loc: null,
  glide: null
})

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

  // When each deviation call last played, or null while it is armed
  const deviationCalledAt = useRef(newDeviationState())
  // Go-around pitch and climb would trip the approach limits, so the calls wait until the next approach
  const deviationInhibited = useRef(false)

  // Re-arm positive-climb callout on go-around
  const goAroundCount = useRef(useGoAroundStore.getState().count)
  useEffect(() => {
    return useGoAroundStore.subscribe((s) => {
      if (s.count !== goAroundCount.current) {
        goAroundCount.current = s.count
        altitude.current.positiveClimb = false
        deviationInhibited.current = true
      }
    })
  }, [])

  // Only on the ground above 40 kt, so a stray "stop" at the gate or in the cruise does nothing
  const rto = useRef<RtoState>({
    active: false,
    startedAt: null,
    calledReverse: false,
    calledDecel: false
  })
  const rtoCount = useRef(useRtoStore.getState().count)
  useEffect(() => {
    return useRtoStore.subscribe((s) => {
      if (s.count === rtoCount.current) return
      rtoCount.current = s.count
      const t = useTelemetryStore.getState().telemetry
      if (!t || !t.onGround || t.ias <= RTO_ARM_MIN_IAS) return
      resetRto(rto.current)
      rto.current.active = true
      rto.current.startedAt = Date.now()
    })
  }, [])

  const tick = async () => {
    const t = useTelemetryStore.getState().telemetry
    if (!t || t.isSlewActive) return

    const sp = speed.current
    const al = altitude.current
    const ls = landing.current
    const p = prev.current
    const vr = vrSpeedRef.current
    const now = Date.now()
    const cabinIsReady = (t.cabinIsReady ?? 0) > 0.5 ? 1 : 0
    const takeoffN1 = Math.min(t.engine1N1 ?? 0, t.engine2N1 ?? 0)
    const fcuAlt = t.fcuAlt ?? 0
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

    if (t.onGround && crossedUp(p.speed, t.ias, 100) && !sp.called100) {
      playSound("100_knots.ogg")
      sp.called100 = true
    }

    if (t.onGround && crossedDown(p.speed, t.ias, 70) && !sp.called70) {
      playSound("70_knots.ogg")
      sp.called70 = true
      // The FO chrono times the 5 minute engine cool down; the announcement plays when it reaches 300 s
      setTimeout(() => {
        if (useSettingsStore.getState().postLandingShutdownEnabled) {
          void simvarSet("1 (>L:INI_FO_CHRONO_BUTTON)")
        }
      }, 5000)
    }

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

    if (t.onGround && p.cabinIsReady === 0 && cabinIsReady === 1) {
      playSound("cabin_ready.ogg")
    }

    if (!t.onGround && t.vs > 120 && t.radioAlt > 30 && !al.positiveClimb) {
      playSound("positive_climb.ogg")
      al.positiveClimb = true
    }

    if (!t.onGround && t.vs > 100 && !al.tenThousandClimb && crossedUp(p.alt, t.alt, 10000)) {
      playSound(t.transitionAltitude < 10000 ? "fl_100.ogg" : "ten_thousand.ogg")
      al.tenThousandClimb = true
    }

    if (!t.onGround && t.vs < -100 && !al.tenThousandDescent && crossedDown(p.alt, t.alt, 10000)) {
      playSound(t.transitionLevel < 10000 ? "fl_100.ogg" : "ten_thousand.ogg")
      al.tenThousandDescent = true
    }

    if (!t.onGround && t.vs > 100 && !al.oneToGo && fcuAlt > 0 && crossedUp(p.alt, t.alt, fcuAlt - 1000)) {
      playSound("one_to_go.ogg")
      al.oneToGo = true
    }

    if (!t.onGround && t.vs < -100 && !al.oneToGo && fcuAlt > 0 && crossedDown(p.alt, t.alt, fcuAlt + 1000)) {
      playSound("one_to_go.ogg")
      al.oneToGo = true
    }

    // Both calls prompt an altimeter change, so they are skipped once it is made (XMLVAR_Baro1_Mode 3 = STD)
    const baroMode = t.baroMode ?? -1
    const onStandard = baroMode === 3
    const baroKnown = baroMode >= 0

    if (
      !t.onGround &&
      t.vs > 100 &&
      !al.transitionAltitude &&
      t.transitionAltitude > 0 &&
      crossedUp(p.alt, t.alt, t.transitionAltitude)
    ) {
      if (!baroKnown || !onStandard) playSound("transiton_altitude.ogg")
      al.transitionAltitude = true
    }

    if (
      !t.onGround &&
      t.vs < -100 &&
      !al.transitionLevel &&
      t.transitionLevel > 0 &&
      crossedDown(p.alt, t.alt, t.transitionLevel)
    ) {
      if (!baroKnown || onStandard) playSound("transiton_level.ogg")
      al.transitionLevel = true
    }

    // Passing altitude "now" callout
    const passingAltStore = usePassingAltitudeStore.getState()
    if (passingAltStore.targetAltitude !== null && !passingAltStore.hasCalled) {
      // Pressure altitude too, because the indicated one jumps when standard is set
      const altReached = t.alt >= passingAltStore.targetAltitude
      const pAltReached = t.pAlt >= passingAltStore.targetAltitude

      if (altReached || pAltReached) {
        playSound("now_at.ogg")
        passingAltStore.markCalled()
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
      usePassingAltitudeStore.getState().reset()
    }

    // Approach deviation calls
    if (t.radioAlt > DEVIATION_MAX_RA || t.onGround) deviationInhibited.current = false

    const inDeviationWindow =
      useSettingsStore.getState().deviationCallsEnabled &&
      !deviationInhibited.current &&
      !t.onGround &&
      t.landingGear > 0.5 &&
      t.radioAlt >= DEVIATION_MIN_RA &&
      t.radioAlt <= DEVIATION_MAX_RA

    if (inDeviationWindow) {
      const exceeded = exceededDeviations(t)
      const calledAt = deviationCalledAt.current
      const pending = (Object.keys(exceeded) as DeviationCall[]).filter((call) => {
        if (!exceeded[call]) {
          if (calledAt[call] !== null && now - calledAt[call] >= DEVIATION_REARM_MS) calledAt[call] = null
          return false
        }
        return calledAt[call] === null
      })

      // One call per tick so they never talk over each other or the other callouts
      if (pending.length > 0 && !(await isSoundPlaying())) {
        playSound(DEVIATION_SOUNDS[pending[0]])
        calledAt[pending[0]] = now
      }
    } else {
      deviationCalledAt.current = newDeviationState()
    }

    // Landing sequence

    // Height rather than a climb, so a flight started on approach still arms; a bounce stays below 100 ft
    if (!t.onGround && t.radioAlt > 100) {
      ls.wasAirborne = true
    }

    if (t.onGround && ls.wasAirborne && ls.phase === "idle" && !ls.done) {
      advancePhase(ls, "spoilers", now)
      ls.wasAirborne = false
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

    // Rejected takeoff - runs on its own state, the landing sequence is untouched
    if (rto.current.active) {
      if (!t.onGround || t.ias < RTO_END_IAS) {
        resetRto(rto.current)
      } else if (!(await isSoundPlaying())) {
        handleRto(rto.current, t, p.speed, now)
      }
    }

    // Waits for the previous call to finish so the sequence never overlaps
    if (ls.phase !== "idle" && !(await isSoundPlaying())) {
      const elapsed = ls.phaseStartTime ? now - ls.phaseStartTime : 0
      const handler = (PHASE_HANDLERS as Record<string, (...args: unknown[]) => unknown>)[ls.phase]
      if (typeof handler === "function") {
        handler(ls, t, elapsed, now)
      } else {
        console.warn(`[useCallouts] Unknown landing phase: ${ls.phase}`)
        // Reset landing sequence to avoid repeated errors
        resetLanding(ls)
      }
    }

    p.speed = t.ias
    p.alt = t.alt
    p.onGround = t.onGround
    p.cabinIsReady = cabinIsReady
    p.takeoffN1 = takeoffN1
    p.fcuAlt = fcuAlt
  }

  useTelemetryTick(tick)
}
