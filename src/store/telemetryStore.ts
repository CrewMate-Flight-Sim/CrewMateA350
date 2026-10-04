import { create } from "zustand"

// Keys are the SIM_VARS keys in useSimConnection.ts; SimConnect sends booleans as numbers too
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
