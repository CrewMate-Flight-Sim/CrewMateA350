import { invoke } from "@tauri-apps/api/core"

export async function simvarSet(variableString: string): Promise<void> {
  return invoke<void>("simvar_set", { variableString })
}

export async function simvarGet(variableString: string): Promise<number | null> {
  return invoke<number | null>("simvar_get", { variableString })
}

/**
 * Write a value to an LVar, logging instead of throwing — a failed write means
 * the FO's action simply did not happen, which is never worth crashing a command.
 * `label` is the human name used in the log. Returns whether the write succeeded,
 * so callers can skip a follow-up acknowledgement sound.
 */
export async function setLvar(value: number, name: string, label: string): Promise<boolean> {
  try {
    await simvarSet(`${value} (>L:${name})`)
    return true
  } catch (error) {
    console.error(`[SimVar] Failed to set ${label} (L:${name}):`, error)
    return false
  }
}

export async function getAircraftTitle(): Promise<string | null> {
  return invoke<string | null>("get_aircraft_title")
}
