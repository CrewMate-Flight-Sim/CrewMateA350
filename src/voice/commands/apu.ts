import { setLvar } from "@/API/simvarApi"
import { delay } from "@/lib/utils"

export async function setStartAPU(position: number) {
  const ok = await setLvar(position, "INI_APU_MASTER_SWITCH", "APU master switch")
  if (!ok) return

  await delay(2000)

  await setLvar(position, "INI_APU_START_BUTTON", "APU start button")
}
