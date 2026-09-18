import { setLvar } from "@/API/simvarApi"

export async function setEngAntiIce(position: number) {
  await setLvar(position, "INI_ENG_ANTI_ICE1_STATE", "engine 1 anti-ice")
  await setLvar(position, "INI_ENG_ANTI_ICE2_STATE", "engine 2 anti-ice")
}

export async function setWingAntiIce(position: number) {
  await setLvar(position, "INI_WING_ANTI_ICE1_STATE", "wing anti-ice")
}
