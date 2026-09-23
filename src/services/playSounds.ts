import { invoke } from "@tauri-apps/api/core"

import { delay } from "@/lib/utils"
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
    console.error("[PlaySounds] Failed to play sound:", error)
  }
}

export const isSoundPlaying = async (): Promise<boolean> => {
  try {
    return await invoke<boolean>("is_audio_playing")
  } catch {
    return false
  }
}

const SOUND_POLL_INTERVAL_MS = 100

/** Resolves once the backend reports no sound is playing. */
export const waitForSoundFinished = async (): Promise<void> => {
  while (await isSoundPlaying()) await delay(SOUND_POLL_INTERVAL_MS)
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
    console.error("[PlaySounds] Failed to play sound sequence:", error)
  }
}
