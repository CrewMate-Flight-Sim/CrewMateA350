import { simvarSet } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"

const WIPERS_SPEED_LIMIT = 230 // knots

export async function setWipers(position: number) {
  try {
    const { telemetry } = useTelemetryStore.getState()
    const currentSpeed = telemetry?.ias ?? 0
    if (position != 3 && currentSpeed > WIPERS_SPEED_LIMIT) {
      playSound("check_speed.ogg")
      return
    }

    const expression1 = `${position} (>L:INI_WIPER_SWITCH_LEFT)`
    const expression2 = `${position} (>L:INI_WIPER_SWITCH_RIGHT)`
    await simvarSet(expression1)
    await simvarSet(expression2)
    playSound("check.ogg")
  } catch (error) {
    console.error("Error setting wipers:", error)
  }
}
