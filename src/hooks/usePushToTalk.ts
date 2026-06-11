import { isRegistered, register, unregister } from "@tauri-apps/plugin-global-shortcut"
import { useEffect, useRef, type RefObject } from "react"

import { useSettingsHydrated } from "@/hooks/useSettingsHydrated"
import { useSettingsStore, type VoiceMode } from "@/store/settingsStore"
import {
  getContinuousShortcutTransition,
  getPttStateTransition,
  normalizePttShortcut,
  PTT_RELEASE_MUTE_DELAY_MS
} from "@/voice/pushToTalkState"

const registerVoiceShortcut = async (
  shortcut: string,
  handler: (event: { state: "Pressed" | "Released" }) => void
): Promise<boolean> => {
  try {
    if (await isRegistered(shortcut)) {
      await unregister(shortcut)
    }

    await register(shortcut, handler)

    if (await isRegistered(shortcut)) {
      return true
    }

    console.error(
      `Voice shortcut "${shortcut}" was not registered. It may already be used by another application.`
    )
    return false
  } catch (error) {
    console.error(`Failed to register voice shortcut "${shortcut}":`, error)
    return false
  }
}

type PttMuteScheduler = {
  clearPendingMute: () => void
  scheduleMute: () => void
}

const handleShortcutEvent = (
  voiceMode: VoiceMode,
  isPressedRef: RefObject<boolean>,
  setVoiceEnabled: (enabled: boolean) => void,
  state: "Pressed" | "Released",
  pttMuteScheduler?: PttMuteScheduler
) => {
  if (voiceMode === "ptt") {
    const wasPressed = isPressedRef.current
    const transition = getPttStateTransition(wasPressed, state)
    isPressedRef.current = transition.isPressed

    if (state === "Pressed") {
      pttMuteScheduler?.clearPendingMute()
      if (transition.voiceEnabled !== undefined) {
        setVoiceEnabled(transition.voiceEnabled)
      }
      return
    }

    if (wasPressed) {
      pttMuteScheduler?.scheduleMute()
    }
    return
  }

  const transition = getContinuousShortcutTransition(
    isPressedRef.current,
    useSettingsStore.getState().voiceEnabled,
    state
  )
  isPressedRef.current = transition.isPressed
  if (transition.voiceEnabled !== undefined) {
    setVoiceEnabled(transition.voiceEnabled)
  }
}

export function usePushToTalk() {
  const hydrated = useSettingsHydrated()
  const voiceMode = useSettingsStore((state) => state.voiceMode)
  const pttShortcut = useSettingsStore((state) => state.pttShortcut)
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled)
  const isPressedRef = useRef(false)
  const muteDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!hydrated) {
      isPressedRef.current = false
      return
    }

    const shortcut = normalizePttShortcut(pttShortcut)
    let registered = false
    let cancelled = false

    const clearPendingMute = () => {
      if (muteDelayRef.current) {
        clearTimeout(muteDelayRef.current)
        muteDelayRef.current = null
      }
    }

    const scheduleMute = () => {
      clearPendingMute()
      muteDelayRef.current = setTimeout(() => {
        muteDelayRef.current = null
        setVoiceEnabled(false)
      }, PTT_RELEASE_MUTE_DELAY_MS)
    }

    if (voiceMode === "ptt") {
      clearPendingMute()
      setVoiceEnabled(false)
    }

    registerVoiceShortcut(shortcut, (event) => {
      handleShortcutEvent(voiceMode, isPressedRef, setVoiceEnabled, event.state, {
        clearPendingMute,
        scheduleMute
      })
    }).then((success) => {
      registered = success
      if (cancelled && success) {
        unregister(shortcut).catch((error) => {
          console.error(`Failed to unregister voice shortcut "${shortcut}":`, error)
        })
      }
    })

    return () => {
      cancelled = true
      isPressedRef.current = false
      clearPendingMute()

      if (voiceMode === "ptt") {
        setVoiceEnabled(false)
      }

      if (!registered) return

      unregister(shortcut).catch((error) => {
        console.error(`Failed to unregister voice shortcut "${shortcut}":`, error)
      })
    }
  }, [hydrated, pttShortcut, setVoiceEnabled, voiceMode])
}
