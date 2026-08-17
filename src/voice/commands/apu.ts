import { simvarSet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"

export async function setStartAPU(position: number) {
  try {
    const expression = `${position} (>L:INI_APU_MASTER_SWITCH)`
    const expression1 = `${position} (>L:INI_APU_START_BUTTON)`

    await simvarSet(expression)

    await delay(2000)

    await simvarSet(expression1)
  } catch (error) {
    console.error("Error setting APU (LVAR):", error)
  }
}
