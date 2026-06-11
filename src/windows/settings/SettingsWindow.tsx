import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { FolderOpen, Mic, Volume2, Option } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useSettingsStore, type VoiceMode } from "@/store/settingsStore"
import { formatShortcutForDisplay } from "@/voice/pushToTalkState"

export function SettingsWindow() {
  const [availableSoundPacks, setAvailableSoundPacks] = useState<string[]>([])
  interface AudioDevice {
    index: string
    name: string
    is_default?: boolean
  }

  const [availableOutputDevices, setAvailableOutputDevices] = useState<AudioDevice[]>([])
  const [availableInputDevices, setAvailableInputDevices] = useState<AudioDevice[]>([])

  const soundPack = useSettingsStore((s) => s.soundPack)
  const setSoundPack = useSettingsStore((s) => s.setSoundPack)
  const soundVolume = useSettingsStore((s) => s.soundVolume)
  const setSoundVolume = useSettingsStore((s) => s.setSoundVolume)
  const confidenceThreshold = useSettingsStore((s) => s.confidenceThreshold)
  const setConfidenceThreshold = useSettingsStore((s) => s.setConfidenceThreshold)
  const voiceMode = useSettingsStore((s) => s.voiceMode)
  const setVoiceMode = useSettingsStore((s) => s.setVoiceMode)
  const pttShortcut = useSettingsStore((s) => s.pttShortcut)
  const outputDevice = useSettingsStore((s) => s.outputDevice)
  const setOutputDevice = useSettingsStore((s) => s.setOutputDevice)
  const inputDevice = useSettingsStore((s) => s.inputDevice)
  const setInputDevice = useSettingsStore((s) => s.setInputDevice)
  const geSoundPack = useSettingsStore((s) => s.geSoundPack)
  const setGeSoundPack = useSettingsStore((s) => s.setGeSoundPack)

  const postLandingShutdownEnabled = useSettingsStore((s) => s.postLandingShutdownEnabled)
  const setPostLandingShutdownEnabled = useSettingsStore((s) => s.setPostLandingShutdownEnabled)

  const holdOnIncorrect = useSettingsStore((s) => s.holdOnIncorrect)
  const setHoldOnIncorrect = useSettingsStore((s) => s.setHoldOnIncorrect)

  const lightsControlMode = useSettingsStore((s) => s.lightsControlMode)
  const setLightsControlMode = useSettingsStore((s) => s.setLightsControlMode)

  useEffect(() => {
    const fetchSoundPacks = async () => {
      try {
        const packs = await invoke<string[]>("get_sound_packs")
        const valid = packs ?? []
        setAvailableSoundPacks(valid)
        const copilot = valid.filter((p) => !p.startsWith("GE_"))
        if (copilot.length > 0 && !copilot.includes(soundPack)) {
          setSoundPack(copilot[0])
        }
        const ge = valid.filter((p) => p.startsWith("GE_"))
        if (ge.length > 0 && !ge.includes(geSoundPack)) {
          setGeSoundPack(ge[0])
        }
      } catch (error) {
        console.error("Failed to fetch sound packs:", error)
      }
    }

    fetchSoundPacks()
  }, [soundPack, setSoundPack, geSoundPack, setGeSoundPack])

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devices = await invoke<AudioDevice[]>("get_available_output_devices")
        setAvailableOutputDevices(devices ?? [])
        if (devices && devices.length > 0 && outputDevice == null) {
          // keep current selection if present; otherwise default -> "default"
          setOutputDevice("default")
          invoke("set_output_device", { device: "default" }).catch(() => {})
        }
      } catch (e) {
        console.error("Failed to fetch output devices", e)
      }
    }

    fetchDevices()
  }, [outputDevice, setOutputDevice])

  useEffect(() => {
    const fetchInputDevices = async () => {
      try {
        const devices = await invoke<AudioDevice[]>("get_speech_input_devices")
        setAvailableInputDevices(devices ?? [])
      } catch (e) {
        console.error("Failed to fetch input devices", e)
      }
    }

    fetchInputDevices()

    // Re-fetch when the sidecar restarts
    const unlistenReady = listen<{ status: string }>("speech_engine_status", (event) => {
      if (event.payload?.status === "ready") fetchInputDevices()
    })

    return () => {
      unlistenReady.then((f) => f())
    }
  }, [])

  useEffect(() => {
    getCurrentWindow()
      .show()
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="space-y-4">
        <SectionHeader icon={<Volume2 className="h-3 w-3 text-cyan-400 shrink-0" />} label="Audio" />

        <div className="grid grid-cols-[110px_1fr] items-center gap-3">
          <Label className="text-sm text-slate-300">Copilot</Label>
          <Select value={soundPack} onValueChange={setSoundPack}>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm focus:ring-cyan-500 w-56 truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-600 text-white max-w-[20rem]">
              {availableSoundPacks
                .filter((p) => !p.startsWith("GE_"))
                .map((pack) => (
                  <SelectItem key={pack} value={pack} className="truncate">
                    {pack}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[110px_1fr] items-center gap-3">
          <Label className="text-sm text-slate-300">Ground Eng.</Label>
          <Select value={geSoundPack} onValueChange={setGeSoundPack}>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm focus:ring-cyan-500 w-56 truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-600 text-white max-w-[20rem]">
              {availableSoundPacks
                .filter((p) => p.startsWith("GE_"))
                .map((pack) => (
                  <SelectItem key={pack} value={pack} className="truncate">
                    {pack.replace(/^GE_/, "")}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[110px_1fr] items-center gap-3">
          <Label className="text-sm text-slate-300">Output Device</Label>
          <Select
            value={outputDevice ?? "default"}
            onValueChange={(v) => {
              setOutputDevice(v === "default" ? null : v)
              invoke("set_output_device", { device: v === "default" ? null : v }).catch(() => {})
            }}
          >
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm focus:ring-cyan-500 w-56 truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-600 text-white max-w-[20rem]">
              {availableOutputDevices.map((d) => (
                <SelectItem key={d.index} value={d.index} className="truncate">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[110px_1fr] items-center gap-3">
          <Label className="flex items-center gap-1 text-sm text-slate-300">Input Device</Label>
          <Select
            value={inputDevice ?? "default"}
            onValueChange={(v) => {
              const device = v === "default" ? null : v
              setInputDevice(device)
              invoke("set_input_device", { device }).catch(() => {})
            }}
          >
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm focus:ring-cyan-500 w-56 truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-600 text-white max-w-[20rem]">
              <SelectItem value="default" className="truncate">
                Default
              </SelectItem>
              {availableInputDevices.map((d) => (
                <SelectItem key={d.index} value={d.name} className="truncate">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SliderRow label="Sound Volume" value={soundVolume} onChange={setSoundVolume} min={0} max={200} step={1} />
        <SliderRow
          label="Voice Sensitivity"
          value={confidenceThreshold}
          onChange={setConfidenceThreshold}
          min={50}
          max={100}
          step={1}
        />

        <SectionHeader icon={<Mic className="h-3 w-3 text-cyan-400 shrink-0" />} label="Voice" />

        <div className="grid grid-cols-[110px_1fr] items-center gap-3">
          <Label className="text-sm text-slate-300">Voice Mode</Label>
          <Select value={voiceMode} onValueChange={(value) => setVoiceMode(value as VoiceMode)}>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm focus:ring-cyan-500 w-56 truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-600 text-white">
              <SelectItem value="continuous">Continuous</SelectItem>
              <SelectItem value="ptt">Push to talk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[110px_1fr] items-center gap-3">
          <Label className="text-sm text-slate-300">Voice Shortcut</Label>
          <span className="w-56 rounded-md border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm font-mono text-cyan-300">
            {formatShortcutForDisplay(pttShortcut)}
          </span>
        </div>

        <SectionHeader icon={<Option className="h-3 w-3 text-cyan-400 shrink-0" />} label="Options" />

        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <Label htmlFor="holdOnIncorrect" className="text-sm text-slate-300 cursor-pointer">
            Hold checklist on incorrect item
          </Label>
          <Checkbox
            id="holdOnIncorrect"
            checked={holdOnIncorrect}
            onCheckedChange={(checked) => setHoldOnIncorrect(checked === true)}
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <Label htmlFor="lightsControlMode" className="text-sm text-slate-300 cursor-pointer">
            Auto Ground lights control
          </Label>
          <Checkbox
            id="lightsControlMode"
            checked={lightsControlMode === "virtual"}
            onCheckedChange={(checked) => setLightsControlMode(checked ? "virtual" : "user")}
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <Label htmlFor="postLandingShutdownEnabled" className="text-sm text-slate-300 cursor-pointer">
            5 minutes to allow shutting down engines
          </Label>
          <Checkbox
            id="postLandingShutdownEnabled"
            checked={postLandingShutdownEnabled}
            onCheckedChange={(checked) => setPostLandingShutdownEnabled(checked === true)}
          />
        </div>

        <Button
          onClick={() => invoke("open_app_data_folder")}
          className="w-full bg-slate-800 border border-slate-500 text-white hover:bg-slate-700 font-semibold py-2"
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Open App Data Folder
        </Button>

        <Button
          onClick={() => getCurrentWindow().close()}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2"
        >
          Close
        </Button>
      </div>
    </div>
  )
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {icon}
      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-slate-700/60" />
    </div>
  )
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
      <Label className="text-sm text-slate-300">{label}</Label>
      <div className="flex items-center gap-3">
        <Slider
          className="flex-1"
          value={[value]}
          onValueChange={(v) => onChange(v[0])}
          min={min}
          max={max}
          step={step}
        />
        <span className="w-12 text-right text-xs text-cyan-400 font-mono">{value}%</span>
      </div>
    </div>
  )
}
