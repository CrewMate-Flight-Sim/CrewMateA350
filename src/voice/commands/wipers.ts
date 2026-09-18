import { setLvar } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"

const WIPERS_SPEED_LIMIT = 230 // knots

export async function setWipers(position: number) {
  const { telemetry } = useTelemetryStore.getState()
  const currentSpeed = telemetry?.ias ?? 0
  if (position != 3 && currentSpeed > WIPERS_SPEED_LIMIT) {
    playSound("check_speed.ogg")
    return
  }

  await setLvar(position, "INI_WIPER_SWITCH_LEFT", "left wiper")
  await setLvar(position, "INI_WIPER_SWITCH_RIGHT", "right wiper")
  playSound("check.ogg")
}
