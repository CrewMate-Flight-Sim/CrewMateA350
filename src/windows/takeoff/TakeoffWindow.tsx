import { emit } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Info } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { usePerformanceStore } from "@/store/performanceStore"

const selectCls =
  "w-full h-8 bg-slate-900/50 border border-slate-600 text-white text-xs rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"

export function TakeoffWindow() {
  const { takeoff, setTakeoffData } = usePerformanceStore()

  useEffect(() => {
    getCurrentWindow()
      .show()
      .catch(() => {})
  }, [])

  const handleChange = (name: string, value: string | number) => {
    setTakeoffData({ [name]: value } as Partial<typeof takeoff>)
    emit("takeoff-updated", { ...takeoff, [name]: value })
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
      {/*  V Speeds */}
      <div className="grid grid-cols-3 gap-2">
        {(["v1", "vr", "v2"] as const).map((speed) => (
          <div key={speed} className="space-y-1">
            <Label htmlFor={speed} className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              {speed.toUpperCase()}
            </Label>
            <Input
              type="number"
              id={speed}
              name={speed}
              min={100}
              max={200}
              value={takeoff[speed] ?? ""}
              onChange={handleNumberInput}
              className="h-8 bg-slate-900/50 border-slate-600 text-white text-xs font-mono text-center px-1 focus-visible:ring-cyan-500"
              placeholder="—"
            />
          </div>
        ))}
      </div>

      {/* Thrust + Packs + Anti Ice */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <div className={labelRow}>
            <Label htmlFor="thrustSetting" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              Thrust
            </Label>
          </div>

          <select
            id="thrustSetting"
            name="thrustSetting"
            value={takeoff.thrustSetting}
            onChange={handleSelectChange}
            className={selectCls}
          >
            <option value="toga">TOGA</option>
            <option value="flex">FLEX</option>
          </select>
        </div>

        <div className="space-y-1">
          <div className={labelRow}>
            <Label htmlFor="packs" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              Packs
            </Label>
          </div>

          <select id="packs" name="packs" value={takeoff.packs} onChange={handleSelectChange} className={selectCls}>
            <option value="on">ON</option>
            <option value="off">OFF</option>
            <option value="apu">APU TO PACK</option>
          </select>
        </div>

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
                  Other than OFF will not set the flaps automatically on after start flow.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <select
            id="antiIce"
            name="antiIce"
            value={takeoff.antiIce}
            onChange={handleSelectChange}
            className={selectCls}
          >
            <option value="off">OFF</option>
            <option value="oneng">ENG</option>
            <option value="onengwing">ENG+WING</option>
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
