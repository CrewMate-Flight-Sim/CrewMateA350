import { listen } from "@tauri-apps/api/event"
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface TakeoffData {
  v1: number
  vr: number
  v2: number
  thrustSetting?: string
  packs?: string
  antiIce?: string
  runway: string
}

interface LandingData {
  flaps: string
  missedAltitude: number
  antiIce?: string
  apuStart?: string
  ls: boolean
}

interface PerformanceStore {
  takeoff: TakeoffData
  landing: LandingData
  setTakeoffData: (data: Partial<TakeoffData>) => void
  setLandingData: (data: Partial<LandingData>) => void
  resetTakeoffData: () => void
  resetLandingData: () => void
}

const defaultTakeoffData: TakeoffData = {
  v1: 0,
  vr: 0,
  v2: 0,
  thrustSetting: "toga",
  packs: "on",
  antiIce: "off",
  runway: ""
}

const defaultLandingData: LandingData = {
  flaps: "Full",
  missedAltitude: 4000,
  antiIce: "off",
  apuStart: "auto",
  ls: true
}

export const usePerformanceStore = create<PerformanceStore>()(
  persist(
    (set) => ({
      takeoff: defaultTakeoffData,
      landing: defaultLandingData,
      setTakeoffData: (data) =>
        set((state) => ({
          takeoff: { ...state.takeoff, ...data }
        })),
      setLandingData: (data) =>
        set((state) => ({
          landing: { ...state.landing, ...data }
        })),
      resetTakeoffData: () => set({ takeoff: defaultTakeoffData }),
      resetLandingData: () => set({ landing: defaultLandingData })
    }),
    {
      name: "performance-data"
    }
  )
)

listen<Partial<TakeoffData>>("takeoff-updated", (event) => {
  usePerformanceStore.getState().setTakeoffData(event.payload)
})

listen<Partial<LandingData>>("landing-updated", (event) => {
  usePerformanceStore.getState().setLandingData(event.payload)
})
