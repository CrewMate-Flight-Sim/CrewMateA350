import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { InputBinding, VoiceMode } from "@/types/input"

export type LightsControlMode = "virtual" | "user"

const defaultLightsControlMode: LightsControlMode = "user"

interface SettingsStore {
  voiceEnabled: boolean
  voiceMode: VoiceMode
  pttBinding: InputBinding | null
  micToggleBinding: InputBinding | null
  soundPack: string
  geSoundPack: string
  soundVolume: number
  outputDevice?: string | null
  inputDevice?: string | null
  holdOnIncorrect: boolean
  lightsControlMode: LightsControlMode
  confidenceThreshold: number
  postLandingShutdownEnabled: boolean
  setVoiceEnabled: (enabled: boolean) => void
  setVoiceMode: (mode: VoiceMode) => void
  setPttBinding: (binding: InputBinding | null) => void
  setMicToggleBinding: (binding: InputBinding | null) => void
  setSoundPack: (pack: string) => void
  setGeSoundPack: (pack: string) => void
  setSoundVolume: (volume: number) => void
  setOutputDevice: (device: string | null) => void
  setInputDevice: (device: string | null) => void
  setHoldOnIncorrect: (hold: boolean) => void
  setLightsControlMode: (mode: LightsControlMode) => void
  setConfidenceThreshold: (threshold: number) => void
  setPostLandingShutdownEnabled: (enabled: boolean) => void
}

let isUpdatingFromEvent = false

const normalizeThreshold = (threshold: number) => Math.min(100, Math.max(0, threshold))
const toEngineThreshold = (threshold: number) => normalizeThreshold(threshold) / 100

const applyConfidenceThreshold = async (threshold: number) => {
  await invoke("set_confidence_threshold", { threshold: toEngineThreshold(threshold) })
}

const applyMicBindings = async (ptt: InputBinding | null, toggle: InputBinding | null) => {
  await invoke("set_mic_bindings", { ptt, toggle })
}

type SettingsValues = {
  [K in keyof SettingsStore as SettingsStore[K] extends (...args: never[]) => unknown ? never : K]: SettingsStore[K]
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      voiceEnabled: false,
      voiceMode: "continuous",
      pttBinding: null,
      micToggleBinding: null,
      soundPack: "Jenny",
      geSoundPack: "GE_Christopher",
      soundVolume: 100,
      outputDevice: null,
      inputDevice: null,
      holdOnIncorrect: false,
      lightsControlMode: defaultLightsControlMode,
      confidenceThreshold: 85,
      postLandingShutdownEnabled: true,

      setVoiceEnabled: (enabled) => {
        set({ voiceEnabled: enabled })
        invoke("set_muted", { muted: !enabled }).catch(() => {})
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { voiceEnabled: enabled })
        }
      },
      setVoiceMode: (mode) => {
        set({ voiceMode: mode })
        invoke("set_voice_mode", { mode }).catch((err) => {
          console.error("[SettingsStore] Failed to apply voice mode:", err)
        })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { voiceMode: mode })
        }
      },
      setPttBinding: (binding) => {
        set({ pttBinding: binding })
        applyMicBindings(binding, get().micToggleBinding).catch((err) => {
          console.error("[SettingsStore] Failed to apply PTT binding:", err)
        })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { pttBinding: binding })
        }
      },
      setMicToggleBinding: (binding) => {
        set({ micToggleBinding: binding })
        applyMicBindings(get().pttBinding, binding).catch((err) => {
          console.error("[SettingsStore] Failed to apply mic toggle binding:", err)
        })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { micToggleBinding: binding })
        }
      },
      setSoundPack: (pack) => {
        set({ soundPack: pack })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { soundPack: pack })
        }
      },
      setGeSoundPack: (pack) => {
        set({ geSoundPack: pack })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { geSoundPack: pack })
        }
      },
      setSoundVolume: (volume) => {
        set({ soundVolume: volume })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { soundVolume: volume })
        }
      },
      setOutputDevice: (device) => {
        set({ outputDevice: device })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { outputDevice: device })
        }
      },
      setInputDevice: (device) => {
        set({ inputDevice: device })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { inputDevice: device })
        }
      },
      setHoldOnIncorrect: (hold) => {
        set({ holdOnIncorrect: hold })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { holdOnIncorrect: hold })
        }
      },
      setLightsControlMode: (mode) => {
        set({ lightsControlMode: mode })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { lightsControlMode: mode })
        }
      },
      setConfidenceThreshold: (threshold) => {
        const safeThreshold = normalizeThreshold(threshold)
        set({ confidenceThreshold: safeThreshold })
        applyConfidenceThreshold(safeThreshold).catch((err) => {
          console.error("[SettingsStore] Failed to apply confidence threshold:", err)
        })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { confidenceThreshold: safeThreshold })
        }
      },
      setPostLandingShutdownEnabled: (enabled) => {
        set({ postLandingShutdownEnabled: enabled })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { postLandingShutdownEnabled: enabled })
        }
      }
    }),
    {
      name: "voice-settings",
      onRehydrateStorage: () => (state) => {
        if (state) {
          const safeThreshold = normalizeThreshold(state.confidenceThreshold)
          if (safeThreshold !== state.confidenceThreshold) {
            useSettingsStore.setState({ confidenceThreshold: safeThreshold })
          }
          applyConfidenceThreshold(safeThreshold).catch((err) => {
            console.error("[SettingsStore] Failed to restore confidence threshold:", err)
          })
        }
        if (state && state.outputDevice) {
          invoke("set_output_device", { device: state.outputDevice }).catch(() => {})
        }
        if (state && state.inputDevice) {
          invoke("set_input_device", { device: state.inputDevice }).catch(() => {})
        }
        if (state) {
          invoke("set_voice_mode", { mode: state.voiceMode }).catch((err) => {
            console.error("[SettingsStore] Failed to restore voice mode:", err)
          })
          applyMicBindings(state.pttBinding ?? null, state.micToggleBinding ?? null).catch((err) => {
            console.error("[SettingsStore] Failed to restore mic bindings:", err)
          })
        }
      }
    }
  )
)

listen<Partial<SettingsValues>>("settings-changed", (event) => {
  isUpdatingFromEvent = true

  if (event.payload.voiceEnabled !== undefined) {
    useSettingsStore.setState({ voiceEnabled: event.payload.voiceEnabled })
  }
  if (event.payload.voiceMode !== undefined) {
    useSettingsStore.setState({ voiceMode: event.payload.voiceMode })
  }
  if (event.payload.pttBinding !== undefined) {
    useSettingsStore.setState({ pttBinding: event.payload.pttBinding })
  }
  if (event.payload.micToggleBinding !== undefined) {
    useSettingsStore.setState({ micToggleBinding: event.payload.micToggleBinding })
  }
  if (event.payload.soundPack !== undefined) {
    useSettingsStore.setState({ soundPack: event.payload.soundPack })
  }
  if (event.payload.geSoundPack !== undefined) {
    useSettingsStore.setState({ geSoundPack: event.payload.geSoundPack })
  }
  if (event.payload.soundVolume !== undefined) {
    useSettingsStore.setState({ soundVolume: event.payload.soundVolume })
  }
  if (event.payload.holdOnIncorrect !== undefined) {
    useSettingsStore.setState({ holdOnIncorrect: event.payload.holdOnIncorrect })
  }
  if (event.payload.lightsControlMode !== undefined) {
    useSettingsStore.setState({ lightsControlMode: event.payload.lightsControlMode })
  }
  if (event.payload.confidenceThreshold !== undefined) {
    useSettingsStore.setState({ confidenceThreshold: event.payload.confidenceThreshold })
  }
  if (event.payload.postLandingShutdownEnabled !== undefined) {
    useSettingsStore.setState({ postLandingShutdownEnabled: event.payload.postLandingShutdownEnabled })
  }
  if (event.payload.outputDevice !== undefined) {
    useSettingsStore.setState({ outputDevice: event.payload.outputDevice })
  }
  if (event.payload.inputDevice !== undefined) {
    useSettingsStore.setState({ inputDevice: event.payload.inputDevice })
  }

  isUpdatingFromEvent = false
})
