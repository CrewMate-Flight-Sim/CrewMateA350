import { setLvar, simvarGet } from "@/API/simvarApi"

export async function setDoorSlides(shouldArm: boolean) {
  const armed = await simvarGet("(L:INI_DOOR0_ARMED)").catch((error) => {
    console.error("[SimVar] Failed to read slides state (L:INI_DOOR0_ARMED):", error)
    return undefined
  })
  if (armed === undefined) return

  // Already in the requested state, do nothing
  if ((armed ?? 0) > 0.5 === shouldArm) return

  await setLvar(1, "INI_SLIDES_REQ", "slides")
}
