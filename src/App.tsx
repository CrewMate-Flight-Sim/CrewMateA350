import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useEffect, useRef } from "react"

import { ChecklistPanel } from "@/components/ChecklistPanel"
import { ConnectionError } from "@/components/connectionError"
import { FlowPanel } from "@/components/FlowPanel"
import { Footer } from "@/components/Footer"
import { IconToolbar } from "@/components/IconToolbar"
import { SpeechEngineError } from "@/components/SpeechEngineError"
import { TextBar } from "@/components/textBar"
import { VoiceGuide } from "@/components/VoiceGuide"
import { useAutoFlows } from "@/hooks/useAutoFlows"
import { useBaroSync } from "@/hooks/useBaroSync"
import { useCallouts } from "@/hooks/useCallouts"
import { useCloseConfirm } from "@/hooks/useCloseConfirm"
import { usePreflightTimer } from "@/hooks/usePreflightTimer"
import { useSimConnection } from "@/hooks/useSimConnection"
import { useSpeechCommands } from "@/hooks/useSpeechCommands"
import { useVoiceHints } from "@/hooks/useVoiceHints"
import { usePerformanceStore } from "@/store/performanceStore"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"

import "./App.css"

function App() {
  useSimConnection()
  useBaroSync()

  const status = useTelemetryStore((state) => state.status)
  const connected = status === "connected"

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled)
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled)
  const takeoffVr = usePerformanceStore((state) => state.takeoff.vr)

  // Use a mutable ref to store previous state memory without triggering extra render cycles
  const wasVoiceEnabledBeforeDisconnect = useRef<boolean | null>(null)

  useCallouts(takeoffVr)
  useAutoFlows()
  usePreflightTimer()
  const { recognizedText, isValidCommand, isUnrecognized, speechKey, speechEngineError } = useSpeechCommands({
    voiceEnabled
  })
  const voiceHintPhase = useVoiceHints({ voiceEnabled, connected })

  useCloseConfirm()

  useEffect(() => {
    getCurrentWindow()
      .show()
      .catch(() => {})
  }, [])

  const currentEvent = usePreflightTimerStore((s) => s.currentEvent)

  // Context-Aware Mute Engine: force-mute on sim disconnect, restore prior
  // voice preference on reconnect (and sync mute state to sidecar on startup).
  useEffect(() => {
    if (!connected) {
      // 1. Sim just disconnected. Cache the user's true preference if we haven't already.
      if (wasVoiceEnabledBeforeDisconnect.current === null) {
        wasVoiceEnabledBeforeDisconnect.current = voiceEnabled
      }
      // 2. Force an immediate system-wide mute to prevent background ghost inputs
      invoke("set_muted", { muted: true }).catch(() => {})
    } else {
      // 3. Sim reconnected. Check if we have a cached state to restore.
      if (wasVoiceEnabledBeforeDisconnect.current !== null) {
        const previousState = wasVoiceEnabledBeforeDisconnect.current

        // Restore the store toggle state to match what it was before drop-out
        setVoiceEnabled(previousState)

        // Signal the sidecar engine using the matching inverse mapping
        invoke("set_muted", { muted: !previousState }).catch(() => {})

        // Reset our tracker memory lane for the next link disruption event
        wasVoiceEnabledBeforeDisconnect.current = null
      } else {
        // 4. Fallback/Standard operation (e.g., initial startup sync)
        invoke("set_muted", { muted: !voiceEnabled }).catch(() => {})
      }
    }
  }, [connected, voiceEnabled, setVoiceEnabled])

  return (
    <div className="flex bg-black flex-col min-h-screen">
      <main className="flex-1 text-white p-2 flex flex-col">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
          {speechEngineError ? (
            <div className="flex-1 flex items-center justify-center">
              <SpeechEngineError message={speechEngineError} />
            </div>
          ) : !connected ? (
            <div className="flex-1 flex items-center justify-center">
              <ConnectionError />
            </div>
          ) : (
            <>
              <IconToolbar
                voiceEnabled={voiceEnabled}
                onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
                voiceDisabled={false}
              />
              <TextBar
                text={recognizedText}
                isValidCommand={isValidCommand}
                isUnrecognized={isUnrecognized}
                speechKey={speechKey}
              />
              {currentEvent && (
                <span className="text-xs text-cyan-300/80 font-mono animate-pulse truncate max-w-[140px]">
                  {currentEvent}
                </span>
              )}
              <FlowPanel />
              <ChecklistPanel />
              <VoiceGuide phase={voiceHintPhase} />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default App
