import { simvarSet } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"

// Autopilot commands
export async function setAutoPilot(position: number) {
  try {
    const expression = `${position} (>L:INI_AP1_BUTTON)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting autopilot (LVAR):", error)
  }
}

export async function setLevelOff(position: number) {
  try {
    const expression = `${position} (>L:INI_FCU_LEVEL_OFF_COMMAND)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error leveling off (LVAR):", error)
  }
}

export async function setLOC(position: number) {
  try {
    const expression = `${position} (>L:INI_LOCALIZER_BUTTON)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting localizer (LVAR):", error)
  }
}

export async function setAPPR(position: number) {
  try {
    const expression = `${position} (>L:AP7_BUTTON)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting approach (LVAR):", error)
  }
}

// Flight director commands
export async function setFlightDirector(position: number) {
  try {
    const expression = `${position} (>L:INI_FD_ON)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting flight director:", error)
  }
}

// Bird commands
export async function setBird(position: number) {
  try {
    const expression = `${position} (>L:INI_TRACK_FPA_STATE)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting flight director and bird:", error)
  }
}

// Speed commands
export async function setAirspeedDial(knots: number) {
  if (knots < 50 || knots > 400) return
  try {
    await simvarSet(`${knots} (>L:INI_AIRSPEED_DIAL)`)
    playSound("check.ogg")
  } catch (error) {
    console.error("Error setting airspeed dial:", error)
  }
}
export async function setSelSpeed(position: number) {
  try {
    const expression = `${position} (>L:INI_FCU_SELECTED_SPEED_BUTTON)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error selecting manual speed:", error)
  }
}
export async function setManagedSpeed(position: number) {
  try {
    const expression = `${position} (>L:INI_FCU_MANAGED_SPEED_BUTTON)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error selecting managed speed:", error)
  }
}

// Heading commands
export async function setHeadingDial(degrees: number) {
  if (degrees < 0 || degrees > 360) return
  try {
    await simvarSet(`${degrees} (>L:INI_HEADING_DIAL)`)
    playSound("check.ogg")
  } catch (error) {
    console.error("Error setting heading dial:", error)
  }
}
export async function setSelHeading(position: number) {
  try {
    const expression = `${position} (>L:INI_FCU_SELECTED_HEADING_BUTTON)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error selecting manual heading:", error)
  }
}
export async function setManagedHeading(position: number) {
  try {
    const expression = `${position} (>L:INI_FCU_MANAGED_HEADING_BUTTON)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error selecting managed heading:", error)
  }
}

// Altitude commands
export async function setAltitudeDial(feet: number) {
  if (feet < 100 || feet > 49000) return
  try {
    await simvarSet(`${feet} (>L:INI_ALTITUDE_DIAL)`)
  } catch (error) {
    console.error("Error setting altitude dial:", error)
  }
}
export async function setSelAlt(position: number) {
  try {
    const expression = `${position} (>L:INI_FCU_ALTITUDE_PULL_COMMAND)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error selecting manual altitude:", error)
  }
}
export async function setManagedAlt(position: number) {
  try {
    const expression = `${position} (>L:INI_FCU_ALTITUDE_PUSH_COMMAND)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error selecting managed altitude:", error)
  }
}
