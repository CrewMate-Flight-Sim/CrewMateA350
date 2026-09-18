import { gsxClient } from "@/API/gsxApi"
import { setLvar } from "@/API/simvarApi"

gsxClient.connect()

export async function setGPU(on: boolean) {
  await setLvar(on ? 1 : 0, "INI_GPU_AVAIL", "GPU")
}

export async function setASU(on: boolean) {
  await setLvar(on ? 1 : 0, "INI_ASU_AVAIL", "ASU")
}

export async function setACU(on: boolean) {
  await setLvar(on ? 1 : 0, "INI_ACU_AVAIL", "ACU")
}

export async function disconnectAllGround() {
  await setGPU(false)
  await setASU(false)
  await setACU(false)
}

export async function callPushback() {
  try {
    await gsxClient.triggerService("Departure")
  } catch (error) {
    console.error("Error calling GSX Pushback (Remote API):", error)
  }
}
