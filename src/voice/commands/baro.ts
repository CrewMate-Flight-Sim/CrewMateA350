import { setLvar } from "@/API/simvarApi"

export async function setStdBaro(position: number) {
  await setLvar(position, "XMLVAR_Baro1_Mode", "captain baro mode")
  await setLvar(position, "XMLVAR_Baro2_Mode", "FO baro mode")
}
