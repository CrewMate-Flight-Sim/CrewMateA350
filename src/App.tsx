import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useEffect } from "react"

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
import { usePushToTalk } from "@/hooks/usePushToTalk"
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
  const voiceMode = useSettingsStore((state) => state.voiceMode)
  const pttShortcut = useSettingsStore((state) => state.pttShortcut)
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled)
  const takeoffVr = usePerformanceStore((state) => state.takeoff.vr)

  useCallouts(takeoffVr)
  useAutoFlows()
  usePreflightTimer()
  usePushToTalk()
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

  // Sync mute state to the sidecar on startup — persisted voiceEnabled may be false
  // but the sidecar always starts unmuted.
  useEffect(() => {
    invoke("set_muted", { muted: voiceMode === "ptt" || !voiceEnabled }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentEvent = usePreflightTimerStore((s) => s.currentEvent)

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
                voiceMode={voiceMode}
                pttShortcut={pttShortcut}
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
