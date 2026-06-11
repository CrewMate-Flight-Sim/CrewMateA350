import { invoke } from "@tauri-apps/api/core"
import { PlaneTakeoff, PlaneLanding, PinIcon, PinOff, Mic, MicOff, SettingsIcon, Clock } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useFlowStore } from "@/store/flowStore"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"
import type { VoiceMode } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import { formatShortcutForDisplay } from "@/voice/pushToTalkState"
import { openLandingWindow, openSettingsWindow, openTakeoffWindow } from "@/windows/windowsHandler"

type IconToolbarProps = {
  voiceEnabled: boolean
  onToggleVoice: () => void
  voiceDisabled: boolean
  voiceMode: VoiceMode
  pttShortcut: string
}

const baseBtn = "w-9 h-9 p-0 bg-transparent border border-slate-700/50 transition"

export function IconToolbar({ voiceEnabled, onToggleVoice, voiceDisabled, voiceMode, pttShortcut }: IconToolbarProps) {
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)

  const timerRunning = usePreflightTimerStore((s) => s.isRunning)
  const remainingSeconds = usePreflightTimerStore((s) => s.remainingSeconds)
  const startTimer = usePreflightTimerStore((s) => s.start)
  const skipMinute = usePreflightTimerStore((s) => s.skipMinute)

  const flowRunning = useFlowStore((s) => s.executionState === "running")

  const telemetry = useTelemetryStore((s) => s.telemetry)
  const N1_IDLE_MAX = 15
  const onGround = (telemetry?.onGround ?? 0) > 0.5
  const enginesOn =
    (telemetry?.engineN1_1 ?? 0) >= N1_IDLE_MAX ||
    (telemetry?.engineN1_2 ?? 0) >= N1_IDLE_MAX ||
    (telemetry?.mixture1 ?? 0) >= 0.5 ||
    (telemetry?.mixture2 ?? 0) >= 0.5

  const timeDisplay = String(Math.floor(remainingSeconds / 60)).padStart(2, "0")
  const isPushToTalk = voiceMode === "ptt"
  const voiceTooltip = isPushToTalk
    ? `Hold ${formatShortcutForDisplay(pttShortcut)} to talk`
    : `Press ${formatShortcutForDisplay(pttShortcut)} to start/stop listening`

  const handleToggleAlwaysOnTop = async () => {
    const newValue = !alwaysOnTop
    try {
      await invoke("set_always_on_top", { alwaysOnTop: newValue })
      setAlwaysOnTop(newValue)
    } catch (error) {
      console.error("Failed to set always on top:", error)
    }
  }

  return (
    <div className="flex items-center gap-5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={isPushToTalk ? undefined : onToggleVoice}
              disabled={voiceDisabled}
              className={cn(
                baseBtn,
                "hover:bg-cyan-400/10",
                voiceEnabled && "border-red-400 hover:border-red-400",
                isPushToTalk && "cursor-default"
              )}
            >
              {voiceEnabled ? <Mic className="w-5 h-5 text-red-400" /> : <MicOff className="w-5 h-5 text-cyan-300" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{voiceTooltip}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleToggleAlwaysOnTop}
              className={cn(baseBtn, "hover:bg-amber-400/10", alwaysOnTop && "border-amber-400")}
            >
              {alwaysOnTop ? (
                <PinOff className="w-5 h-5 text-amber-400" />
              ) : (
                <PinIcon className="w-5 h-5 text-amber-300" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{alwaysOnTop ? "Unpin App" : "Pin App"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={timerRunning ? skipMinute : startTimer}
              disabled={flowRunning || !onGround || enginesOn}
              className={cn(
                baseBtn,
                timerRunning ? "border-blue-600 hover:bg-blue-600/10 w-auto px-2 gap-1.5" : "hover:bg-blue-400/10"
              )}
            >
              <Clock className={cn("w-5 h-5", timerRunning ? "text-blue-600" : "text-blue-400")} />
              {timerRunning && <span className="text-xs font-mono text-blue-300">{timeDisplay}m</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{timerRunning ? "Skip 1 min" : "Start preflight countdown"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={openTakeoffWindow} className={cn(baseBtn, "hover:bg-emerald-400/10")}>
              <PlaneTakeoff className="w-5 h-5 text-emerald-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Takeoff Performance</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={openLandingWindow} className={cn(baseBtn, "hover:bg-violet-400/10")}>
              <PlaneLanding className="w-5 h-5 text-violet-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Landing Performance</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={openSettingsWindow} className={cn(baseBtn, "hover:bg-slate-400/10")}>
              <SettingsIcon className="w-5 h-5 text-slate-300" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
