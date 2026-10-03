import { Loader2, Mic, Play, Square, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { ALL_CHECKLISTS } from "@/services/checklistLoader"
import { abortChecklist, executeChecklist } from "@/services/checklistRunner"
import { useChecklistStore } from "@/store/checklistStore"
import type { ChecklistItem } from "@/types/checklist"

export function ChecklistPanel() {
  const { currentChecklist, currentStepIndex, stepStatuses, executionState } = useChecklistStore()
  const isRunning = executionState === "running"
  const totalItems = currentChecklist?.items.length ?? 0
  const completedItems = stepStatuses.filter((s) => s === "complete").length

  const [selectedId, setSelectedId] = useState<string>(ALL_CHECKLISTS[0]?.id ?? "")

  useEffect(() => {
    if (currentChecklist) setSelectedId(currentChecklist.id)
  }, [currentChecklist])

  const isSilent = ALL_CHECKLISTS.find((c) => c.id === selectedId)?.mode === "silent"
  const activeItem: ChecklistItem | null =
    isRunning && currentChecklist ? (currentChecklist.items[currentStepIndex] ?? null) : null

  return (
    <div className="mt-1 space-y-1">
      {/* Selector row */}
      <div className="flex items-center gap-1.5">
        <span className="text-amber-400 text-xs font-mono shrink-0">CL</span>
        <select
          aria-label="Select checklist"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isRunning && currentChecklist?.id !== selectedId}
          className="flex-1 min-w-0 h-6 px-1.5 text-xs bg-transparent border border-slate-700/50 text-slate-200 rounded"
        >
          {ALL_CHECKLISTS.map((cl) => (
            <option key={cl.id} value={cl.id} className="bg-slate-900 text-slate-200">
              {cl.name}
            </option>
          ))}
        </select>

        <Button
          onClick={() => {
            if (isRunning && currentChecklist?.id === selectedId) {
              abortChecklist()
            } else if (selectedId) {
              executeChecklist(selectedId)
            }
          }}
          disabled={isRunning && currentChecklist?.id !== selectedId}
          aria-label={isRunning && currentChecklist?.id === selectedId ? "Stop checklist" : "Run checklist"}
          className={`h-6 px-2 text-xs bg-transparent border border-slate-700/50 hover:bg-amber-400/10 transition shrink-0 ${
            isRunning && currentChecklist?.id === selectedId ? "border-amber-400 bg-amber-400/10" : ""
          } ${isRunning && currentChecklist?.id !== selectedId ? "opacity-40" : ""}`}
        >
          {isRunning && currentChecklist?.id === selectedId ? (
            <Square className="w-2.5 h-2.5 text-red-400" />
          ) : (
            <Play className="w-2.5 h-2.5 text-amber-300" />
          )}
        </Button>
      </div>

      {/* Running state */}
      {currentChecklist && executionState !== "idle" && (
        <div className="space-y-1">
          {/* Silent mode */}
          {isSilent && isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400 shrink-0" />
              <span>Checking…</span>
            </div>
          )}

          {/* Silent mode results — show failed items */}
          {isSilent && !isRunning && executionState === "error" && (
            <div className="space-y-0.5">
              {currentChecklist.items.map((item, i) =>
                stepStatuses[i] === "failed" ? (
                  <div key={i} className="flex items-center gap-1 text-xs text-red-400">
                    <X className="w-2.5 h-2.5 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Normal mode — current item + progress (VoiceGuide handles response hints) */}
          {!isSilent && isRunning && activeItem && (
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <Mic className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span className="text-xs font-medium text-amber-300 truncate">{activeItem.label}</span>
              </div>
              <span className="text-xs text-slate-500 shrink-0">
                {completedItems}/{totalItems}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
