import { setLvar } from "@/API/simvarApi"

export async function setLandingLights(position: number) {
  await setLvar(position, "INI_LIGHTS_LANDING", "landing lights")
}

export async function setStrobeLights(position: number) {
  await setLvar(position, "INI_LIGHTS_STROBE", "strobe lights")
}

export async function setTaxiLights(position: number) {
  await setLvar(position, "INI_LIGHTS_NOSE", "taxi lights")
}
