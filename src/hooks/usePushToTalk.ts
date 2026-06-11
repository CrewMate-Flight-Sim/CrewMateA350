import { Channel, invoke } from "@tauri-apps/api/core"
import { useEffect, useRef } from "react"

import { useSettingsStore } from "@/store/settingsStore"

type ShortcutState = "Pressed" | "Released"

type ShortcutEvent = {
  id: number
  shortcut: string
  state: ShortcutState
}

const registerShortcut = async (shortcut: string, onEvent: (event: ShortcutEvent) => void): Promise<void> => {
  const handler = new Channel<ShortcutEvent>()
  handler.onmessage = onEvent

  await invoke("plugin:global-shortcut|register", {
    shortcuts: [shortcut],
    handler
  })
}

const unregisterShortcut = async (shortcut: string): Promise<void> => {
  await invoke("plugin:global-shortcut|unregister", {
    shortcuts: [shortcut]
  })
}

export const normalizePttShortcut = (shortcut: string): string => shortcut.replace(/^CmdOrCtrl\+/i, "CommandOrControl+")

export function usePushToTalk() {
  const voiceMode = useSettingsStore((state) => state.voiceMode)
  const pttShortcut = useSettingsStore((state) => state.pttShortcut)
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled)
  const isPressedRef = useRef(false)

  useEffect(() => {
    if (voiceMode !== "ptt") {
      isPressedRef.current = false
      return
    }

    const shortcut = normalizePttShortcut(pttShortcut)
    let registered = false
    let cancelled = false

    setVoiceEnabled(false)

    registerShortcut(shortcut, (event) => {
      if (event.state === "Pressed" && !isPressedRef.current) {
        isPressedRef.current = true
        setVoiceEnabled(true)
        return
      }

      if (event.state === "Released" && isPressedRef.current) {
        isPressedRef.current = false
        setVoiceEnabled(false)
      }
    })
      .then(() => {
        registered = true
        if (cancelled) {
          unregisterShortcut(shortcut).catch((error) => {
            console.error(`Failed to unregister push-to-talk shortcut "${shortcut}":`, error)
          })
        }
      })
      .catch((error) => {
        console.error(`Failed to register push-to-talk shortcut "${shortcut}":`, error)
      })

    return () => {
      cancelled = true
      isPressedRef.current = false
      setVoiceEnabled(false)

      if (!registered) return

      unregisterShortcut(shortcut).catch((error) => {
        console.error(`Failed to unregister push-to-talk shortcut "${shortcut}":`, error)
      })
    }
  }, [pttShortcut, setVoiceEnabled, voiceMode])
}
