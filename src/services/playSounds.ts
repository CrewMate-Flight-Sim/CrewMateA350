import { invoke } from "@tauri-apps/api/core"

import { useSettingsStore } from "@/store/settingsStore"

interface PlaySoundOptions {
  pack?: string
  volume?: number
}

export const playSound = async (filename: string, options?: PlaySoundOptions) => {
  try {
    const state = useSettingsStore.getState()
    const soundPack = options?.pack ?? state.soundPack
    const volume = options?.volume ?? state.soundVolume / 100
    await invoke("play_sound", {
      filename,
      pack: soundPack,
      volume
    })
  } catch (error) {
    console.error("Error playing sound via backend:", error)
  }
}

export const isSoundPlaying = async (): Promise<boolean> => {
  try {
    return await invoke<boolean>("is_audio_playing")
  } catch {
    return false
  }
}

/// Play a list of sound files back-to-back (silence-trimmed, gapless).
export const playSoundSequence = async (filenames: string[], options?: PlaySoundOptions) => {
  try {
    const state = useSettingsStore.getState()
    const soundPack = options?.pack ?? state.soundPack
    const volume = options?.volume ?? state.soundVolume / 100
    const files = filenames.map((filename) => ({ filename, pack: soundPack }))
    await invoke("play_sound_sequence", { files, volume })
  } catch (error) {
    console.error("Error playing sound sequence via backend:", error)
  }
}
