import { simvarSet } from "@/API/simvarApi"

export async function setEngAntiIce(position: number) {
  try {
    const expression1 = `${position} (>L:INI_ENG_ANTI_ICE1_STATE)`
    const expression2 = `${position} (>L:INI_ENG_ANTI_ICE2_STATE)`
    await simvarSet(expression1)
    await simvarSet(expression2)
  } catch (error) {
    console.error("Error setting engine anti-ice:", error)
  }
}

export async function setWingAntiIce(position: number) {
  try {
    const expression = `${position} (>L:INI_WING_ANTI_ICE1_STATE)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting wing anti ice:", error)
  }
}
