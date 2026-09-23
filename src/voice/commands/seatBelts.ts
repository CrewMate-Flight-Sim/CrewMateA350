import { setLvar } from "@/API/simvarApi"

export async function setSeatBelts(position: number) {
  await setLvar(position, "INI_SEATBELTS_SWITCH", "seat belts")
}
