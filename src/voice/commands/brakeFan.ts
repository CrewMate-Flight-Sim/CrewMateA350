import { simvarSet } from "@/API/simvarApi"

export async function setBrakeFan(position: number) {
  try {
    const expression = `${position} (>L:INI_BRAKE_FAN_ON)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting brake fan:", error)
  }
}
