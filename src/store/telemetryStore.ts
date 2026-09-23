import { create } from "zustand"

/**
 * Dynamic telemetry payload — keys match the `simVars` array in useSimConnection.ts.
 * All values are numbers (booleans come through as floats from SimConnect).
 * Adding a new variable only requires adding an entry to `simVars` — no type changes needed.
 */
export type Telemetry = Record<string, number>

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

interface TelemetryStore {
  telemetry: Telemetry | null
  status: ConnectionStatus
  aircraftTitle: string | null

  setTelemetry: (data: Telemetry) => void
  setStatus: (status: ConnectionStatus) => void
  setAircraftTitle: (title: string | null) => void
}

export const useTelemetryStore = create<TelemetryStore>()((set) => ({
  telemetry: null,
  status: "disconnected",
  aircraftTitle: null,

  setTelemetry: (data) => set({ telemetry: data }),
  setStatus: (status) => set({ status }),
  setAircraftTitle: (title) => set({ aircraftTitle: title })
}))
