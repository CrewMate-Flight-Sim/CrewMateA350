import { Play, Square } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { allFlows } from "@/services/flowLoader"
import { executeFlow, abortFlow } from "@/services/flowRunner"
import { useFlowStore } from "@/store/flowStore"

export function FlowPanel() {
  const { currentFlow, executionState } = useFlowStore()
  const isRunning = executionState === "running"

  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(allFlows[0]?.id ?? null)

  useEffect(() => {
    if (currentFlow) setSelectedFlowId(currentFlow.id)
  }, [currentFlow])

  return (
    <div className="mt-1 space-y-1">
      {/* Flow selector + play/stop */}
      <div className="flex items-center gap-1.5">
        <span className="text-amber-400 text-xs font-mono shrink-0">Flow</span>

        <select
          aria-label="Select flow"
          value={selectedFlowId ?? ""}
          onChange={(e) => setSelectedFlowId(e.target.value || null)}
          disabled={isRunning && currentFlow?.id !== selectedFlowId}
          className="flex-1 min-w-0 h-6 px-1.5 text-xs bg-transparent border border-slate-700/50 text-slate-200 rounded"
        >
          {allFlows.map((flow) => (
            <option key={flow.id} value={flow.id} className="bg-slate-900 text-slate-200">
              {flow.name}
            </option>
          ))}
        </select>

        <Button
          onClick={() => {
            if (isRunning && currentFlow?.id === selectedFlowId) {
              abortFlow()
            } else if (selectedFlowId) {
              executeFlow(selectedFlowId)
            }
          }}
          disabled={isRunning && currentFlow?.id !== selectedFlowId}
          className={`h-6 px-2 text-xs bg-transparent border border-slate-700/50 hover:bg-amber-400/10 transition shrink-0 ${
            isRunning && currentFlow?.id === selectedFlowId ? "border-amber-400 bg-amber-400/10" : ""
          } ${isRunning && currentFlow?.id !== selectedFlowId ? "opacity-40" : ""}`}
        >
          {isRunning && currentFlow?.id === selectedFlowId ? (
            <Square className="w-2.5 h-2.5 text-red-400" />
          ) : (
            <Play className="w-2.5 h-2.5 text-amber-300" />
          )}
        </Button>
      </div>
    </div>
  )
}
