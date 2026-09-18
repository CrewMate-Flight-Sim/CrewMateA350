import { setLvar } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"

// Autopilot commands
export async function setAutoPilot(position: number) {
  await setLvar(position, "INI_AP1_BUTTON", "autopilot")
}

export async function setLevelOff(position: number) {
  await setLvar(position, "INI_FCU_LEVEL_OFF_COMMAND", "level off")
}

export async function setLOC(position: number) {
  await setLvar(position, "INI_LOCALIZER_BUTTON", "localizer")
}

export async function setAPPR(position: number) {
  await setLvar(position, "AP7_BUTTON", "approach")
}

// Flight director commands
export async function setFlightDirector(position: number) {
  await setLvar(position, "INI_FD_ON", "flight director")
}

// Bird commands
export async function setBird(position: number) {
  await setLvar(position, "INI_TRACK_FPA_STATE", "bird")
}

// Speed commands
export async function setAirspeedDial(knots: number) {
  if (knots < 50 || knots > 400) return
  if (await setLvar(knots, "INI_AIRSPEED_DIAL", "airspeed dial")) {
    playSound("check.ogg")
  }
}

export async function setSelSpeed(position: number) {
  await setLvar(position, "INI_FCU_SELECTED_SPEED_BUTTON", "selected speed")
}

export async function setManagedSpeed(position: number) {
  await setLvar(position, "INI_FCU_MANAGED_SPEED_BUTTON", "managed speed")
}

// Heading commands
export async function setHeadingDial(degrees: number) {
  if (degrees < 0 || degrees > 360) return
  if (await setLvar(degrees, "INI_HEADING_DIAL", "heading dial")) {
    playSound("check.ogg")
  }
}

export async function setSelHeading(position: number) {
  await setLvar(position, "INI_FCU_SELECTED_HEADING_BUTTON", "selected heading")
}

export async function setManagedHeading(position: number) {
  await setLvar(position, "INI_FCU_MANAGED_HEADING_BUTTON", "managed heading")
}

// Altitude commands
export async function setAltitudeDial(feet: number) {
  if (feet < 100 || feet > 49000) return
  await setLvar(feet, "INI_ALTITUDE_DIAL", "altitude dial")
}

export async function setSelAlt(position: number) {
  await setLvar(position, "INI_FCU_ALTITUDE_PULL_COMMAND", "selected altitude")
}

export async function setManagedAlt(position: number) {
  await setLvar(position, "INI_FCU_ALTITUDE_PUSH_COMMAND", "managed altitude")
}
