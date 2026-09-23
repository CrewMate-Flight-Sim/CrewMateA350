import { setLvar } from "@/API/simvarApi"

export async function setBrakeFan(position: number) {
  await setLvar(position, "INI_BRAKE_FAN_ON", "brake fan")
}
