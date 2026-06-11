import { isRegistered, register, unregister } from "@tauri-apps/plugin-global-shortcut"
import { useEffect, useRef } from "react"

import { useSettingsHydrated } from "@/hooks/useSettingsHydrated"
import { useSettingsStore } from "@/store/settingsStore"
import { getShortcutToggleTransition, normalizePttShortcut } from "@/voice/pushToTalkState"

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

export function usePushToTalk() {
  const hydrated = useSettingsHydrated()
  const voiceMode = useSettingsStore((state) => state.voiceMode)
  const pttShortcut = useSettingsStore((state) => state.pttShortcut)
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled)
  const isPressedRef = useRef(false)

  useEffect(() => {
    if (!hydrated || voiceMode !== "ptt") {
      isPressedRef.current = false
      return
    }

    const shortcut = normalizePttShortcut(pttShortcut)
    let registered = false
    let cancelled = false

    setVoiceEnabled(false)

    registerVoiceShortcut(shortcut, (event) => {
      const transition = getShortcutToggleTransition(
        isPressedRef.current,
        useSettingsStore.getState().voiceEnabled,
        event.state
      )
      isPressedRef.current = transition.isPressed
      if (transition.voiceEnabled !== undefined) {
        setVoiceEnabled(transition.voiceEnabled)
      }
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
      setVoiceEnabled(false)

      if (!registered) return

      unregister(shortcut).catch((error) => {
        console.error(`Failed to unregister voice shortcut "${shortcut}":`, error)
      })
    }
  }, [hydrated, pttShortcut, setVoiceEnabled, voiceMode])
}
