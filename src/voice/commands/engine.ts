import { setLvar, simvarGet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { executeFlow } from "@/services/flowRunner"

export async function setIgnKnob(position: number) {
  await setLvar(position, "INI_IGNITION_KNOB", "ignition knob")
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
  const ok = await setLvar(position, "INI_MIXTURE_RATIO2_HANDLE", "engine 2 master")
  if (ok && position === 1) {
    monitorEngine2Start()
  }
}
