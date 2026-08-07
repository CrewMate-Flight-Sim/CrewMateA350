import { emit } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Info } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { usePerformanceStore } from "@/store/performanceStore"

const selectCls =
  "w-full h-8 bg-slate-900/50 border border-slate-600 text-white text-xs rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"

export function LandingWindow() {
  const { landing, setLandingData } = usePerformanceStore()
  const missedRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getCurrentWindow()
      .show()
      .catch(() => {})
  }, [])

  useEffect(() => {
    const input = missedRef.current
    if (!input) return
    const handler = (e: WheelEvent) => e.preventDefault()
    input.addEventListener("wheel", handler, { passive: false })
    return () => input.removeEventListener("wheel", handler)
  }, [])

  const handleMissedWheel = useCallback(
    (e: React.WheelEvent<HTMLInputElement>) => {
      const step = 100
      const min = 1000
      const max = 20000
      const input = missedRef.current
      const current = input?.value ? Number(input.value) : 0
      const next = Math.round((e.deltaY > 0 ? current - step : current + step) / step) * step
      const clamped = Math.max(min, Math.min(max, next))
      setLandingData({ missedAltitude: clamped })
      emit("landing-updated", { ...landing, missedAltitude: clamped })
    },
    [landing, setLandingData]
  )

  const handleChange = (name: string, value: string | number) => {
    setLandingData({ [name]: value } as Partial<typeof landing>)
    emit("landing-updated", { ...landing, [name]: value })
  }

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e.target.name, Number(e.target.value))
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleChange(e.target.name, e.target.value)
  }

  const labelRow = "flex items-center gap-1 h-4"

  return (
    <div className="h-screen bg-black text-white p-3 flex flex-col gap-3">
      {/*Flaps + Missed Approach */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="flaps" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
            Flaps
          </Label>
          <select id="flaps" name="flaps" value={landing.flaps} onChange={handleSelectChange} className={selectCls}>
            <option value="3">3</option>
            <option value="Full">Full</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="missedAltitude" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
            Missed App (ft)
          </Label>
          <Input
            ref={missedRef}
            type="number"
            min={1000}
            max={20000}
            id="missedAltitude"
            name="missedAltitude"
            value={landing.missedAltitude}
            onChange={handleNumberInput}
            onWheel={(e) => {
              e.preventDefault()
              handleMissedWheel(e)
            }}
            className="h-8 bg-slate-900/50 border-slate-600 text-white text-xs font-mono text-center px-1 focus-visible:ring-cyan-500"
            placeholder="4000"
          />
        </div>
      </div>

      {/* Anti Ice + APU Start */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className={labelRow}>
            <Label htmlFor="antiIce" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              Anti Ice
            </Label>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-slate-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[200px]">
                  Will leave Flaps down on "After Landing" flow if Anti Ice is used
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <select
            id="antiIce"
            name="antiIce"
            value={landing.antiIce}
            onChange={handleSelectChange}
            className={selectCls}
          >
            <option value="off">OFF</option>
            <option value="oneng">ENG</option>
          </select>
        </div>

        <div className="space-y-1">
          <div className={labelRow}>
            <Label htmlFor="apuStart" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              APU
            </Label>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-slate-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[200px]">
                  Will start the APU on "After Landing" flow if set to "Auto"
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <select
            id="apuStart"
            name="apuStart"
            value={landing.apuStart}
            onChange={handleSelectChange}
            className={selectCls}
          >
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      <Button
        onClick={() => getCurrentWindow().close()}
        className="w-full h-8 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm mt-3"
      >
        Ok
      </Button>
    </div>
  )
}
