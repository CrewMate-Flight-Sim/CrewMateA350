import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { useEffect, useState } from "react"

import { useChecklistStore } from "@/store/checklistStore"
import { useFoPresenceStore } from "@/store/foPresenceStore"
import { checklistAbortCommands, dispatchFoCommand, foAwayAllowedCommands } from "@/voice/commandDispatch"

type SpeechRecognizedPayload = {
  type?: string
  text?: string
  confidence?: number
  commandType?: string
  payload?: Record<string, unknown>
}

type UseSpeechCommandsOptions = {
  voiceEnabled: boolean
}

export function useSpeechCommands({ voiceEnabled }: UseSpeechCommandsOptions) {
  const [recognizedText, setRecognizedText] = useState<string | null>(null)
  const [isValidCommand, setIsValidCommand] = useState(false)
  const [isUnrecognized, setIsUnrecognized] = useState(false)
  const [speechKey, setSpeechKey] = useState(0)
  const [speechEngineError, setSpeechEngineError] = useState<string | null>(null)

  // Detect missing language
  useEffect(() => {
    invoke<string | null>("get_speech_engine_error")
      .then((err) => {
        if (err) setSpeechEngineError(err)
      })
      .catch(() => {})

    const unlistenError = listen<{ message?: string }>("speech_engine_error", (event) => {
      if (event.payload?.message) setSpeechEngineError(event.payload.message)
    })

    return () => {
      unlistenError.then((f) => f())
    }
  }, [])

  useEffect(() => {
    const unlistenSpeech = listen<SpeechRecognizedPayload>("speech_recognized", async (event) => {
      if (!voiceEnabled) return

      const spokenText = event.payload?.text?.trim().toLowerCase()
      if (!spokenText) return

      setSpeechKey((k) => k + 1)

      // Sidecar heard speech but it didn't match any known grammar — show in amber
      if (event.payload?.type === "speech_unrecognized") {
        setRecognizedText(spokenText)
        setIsValidCommand(false)
        setIsUnrecognized(true)
        return
      }

      setIsUnrecognized(false)

      const { commandType, payload } = event.payload

      const foAway = useFoPresenceStore.getState().isActive
      const isAllowedWhileAway = commandType === "discrete" && foAwayAllowedCommands.has(payload?.command as string)

      if (foAway && !isAllowedWhileAway) {
        setRecognizedText(spokenText)
        setIsValidCommand(false)
        return
      }

      // While a checklist is running, only allow explicit abort commands through.
      // All other voice commands are suppressed — the checklist runner handles
      // speech directly. We still display the text so the user sees their response.
      const checklistRunning = useChecklistStore.getState().executionState === "running"
      const isAbortCommand = commandType === "discrete" && checklistAbortCommands.has(payload?.command as string)

      if (checklistRunning && !isAbortCommand) {
        setRecognizedText(spokenText)
        setIsValidCommand(false)
        return
      }

      setRecognizedText(spokenText)

      if (commandType && payload !== undefined) {
        const handled = await dispatchFoCommand(commandType, payload)
        setIsValidCommand(handled)
        return
      }

      // Fallback: commandType present but no payload (fma_callout emits no payload)
      if (commandType) {
        const handled = await dispatchFoCommand(commandType, {})
        setIsValidCommand(handled)
        return
      }

      setIsValidCommand(false)
    })

    return () => {
      unlistenSpeech.then((f) => f())
    }
  }, [voiceEnabled])

  return { recognizedText, isValidCommand, isUnrecognized, speechKey, speechEngineError }
}
