import { simvarGet, simvarSet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { executeFlow } from "@/services/flowRunner"
export async function setIgnKnob(position: number) {
  try {
    const expression = `${position} (>L:INI_IGNITION_KNOB)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting ignition knob", error)
  }
}
async function monitorEngine2Start() {
  // Polling for up to 60 seconds
  for (let i = 0; i < 600; i++) {
    const n1 = await simvarGet("(A:TURB ENG N1:2,Percent)")

    // Trigger flow when N1 hits the target window
    if (n1 !== null && n1 >= 21) {
      executeFlow("after_start_e2")
      break
    }
    await delay(100)
  }
}
export async function startEngine2(position: number) {
  try {
    const expression = `${position} (>L:INI_MIXTURE_RATIO2_HANDLE)`
    await simvarSet(expression)
    if (position === 1) {
      monitorEngine2Start()
    }
  } catch (error) {
    console.error("Error starting engine 2:", error)
  }
}
