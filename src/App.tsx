import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useEffect, useRef } from "react"

import { ChecklistPanel } from "@/components/ChecklistPanel"
import { ConnectionError } from "@/components/ConnectionError"
import { FlowPanel } from "@/components/FlowPanel"
import { Footer } from "@/components/Footer"
import { IconToolbar } from "@/components/IconToolbar"
import { SpeechEngineError } from "@/components/SpeechEngineError"
import { TextBar } from "@/components/TextBar"
import { VoiceGuide } from "@/components/VoiceGuide"
import { useAutoFlows } from "@/hooks/useAutoFlows"
import { useBaroSync } from "@/hooks/useBaroSync"
import { useCallouts } from "@/hooks/useCallouts"
import { useCloseConfirm } from "@/hooks/useCloseConfirm"
import { usePreflightTimer } from "@/hooks/usePreflightTimer"
import { useSimConnection } from "@/hooks/useSimConnection"
import { useSpeechCommands } from "@/hooks/useSpeechCommands"
import { useVoiceHints } from "@/hooks/useVoiceHints"
import { useFlowStore } from "@/store/flowStore"
import { useFoPresenceStore } from "@/store/foPresenceStore"
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

  const { currentFlow, executionState } = useFlowStore()
  const isRunning = executionState === "running"

  // Ref to track the latest voiceEnabled without triggering re-renders in connection effect
  const voiceEnabledRef = useRef(voiceEnabled)
  voiceEnabledRef.current = voiceEnabled

  // Mutable memory to persist preference state across connection dropouts
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
  const foAway = useFoPresenceStore((s) => s.isActive)

  // Context-Aware Mute Engine: handle sim disconnect/reconnect and sync sidecar mute
  useEffect(() => {
    if (!connected) {
      if (wasVoiceEnabledBeforeDisconnect.current === null) {
        wasVoiceEnabledBeforeDisconnect.current = voiceEnabledRef.current
      }
      invoke("set_muted", { muted: true }).catch(() => {})
    } else {
      if (wasVoiceEnabledBeforeDisconnect.current !== null) {
        const previousState = wasVoiceEnabledBeforeDisconnect.current
        setVoiceEnabled(previousState)
        invoke("set_muted", { muted: !previousState }).catch(() => {})
        wasVoiceEnabledBeforeDisconnect.current = null
      } else {
        invoke("set_muted", { muted: !voiceEnabledRef.current }).catch(() => {})
      }
    }
  }, [connected, setVoiceEnabled])

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
              {foAway && <span className="text-xs text-amber-400/80 font-mono">FO outside</span>}

              {/* Running Flow Indicator */}
              {currentFlow && isRunning && (
                <div className="flex items-center gap-2 py-1">
                  <div className="w-1.5 h-1.5 bg-orange-400/60 rounded-full animate-pulse" />
                  <span className="font-normal text-xs tracking-wide opacity-90 text-slate-400">
                    Flow {currentFlow.name} running
                  </span>
                </div>
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
