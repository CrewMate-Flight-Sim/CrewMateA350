import * as updater from "@tauri-apps/plugin-updater"
import { Download, RefreshCcw } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type StatusKind = "idle" | "info" | "success" | "error"

interface Status {
  message: string
  kind: StatusKind
}

const parseErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "unknown error"
  }
}

const statusColour: Record<StatusKind, string> = {
  idle: "text-slate-400",
  info: "text-blue-400",
  success: "text-green-400",
  error: "text-red-400"
}

export function UpdateChecker() {
  const [status, setStatus] = useState<Status>({ message: "", kind: "idle" })
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<updater.Update | null>(null)

  const handleCheck = async () => {
    setChecking(true)
    setStatus({ message: "Checking…", kind: "info" })
    try {
      const res = await updater.check()
      if (!res) {
        setStatus({ message: "Up to date", kind: "success" })
        setUpdateInfo(null)
      } else {
        setStatus({ message: `v${res.version} available`, kind: "info" })
        setUpdateInfo(res)
      }
    } catch (e) {
      const details = parseErrorMessage(e)
      console.error("[UpdateChecker] Update check failed:", e)
      setStatus({
        message: `Check failed (${details.slice(0, 80)}). Retry in a moment.`,
        kind: "error"
      })
    } finally {
      setChecking(false)
    }
  }

  const handleInstall = async () => {
    if (!updateInfo) return
    setInstalling(true)
    setStatus({ message: "Starting download…", kind: "info" })

    let downloaded = 0
    let total = 0

    try {
      await updateInfo.downloadAndInstall((ev) => {
        if (ev.event === "Started") {
          total = ev.data.contentLength ?? 0
          setStatus({ message: "Downloading…", kind: "info" })
        } else if (ev.event === "Progress") {
          downloaded += ev.data.chunkLength
          const pct = total > 0 ? Math.round((downloaded / total) * 100) : null
          setStatus({ message: pct !== null ? `Downloading… ${pct}%` : "Downloading…", kind: "info" })
        } else if (ev.event === "Finished") {
          setStatus({ message: "Installing…", kind: "info" })
        }
      })
      setStatus({ message: "Relaunch to update", kind: "success" })
    } catch (e) {
      const details = parseErrorMessage(e)
      console.error("[UpdateChecker] Install failed:", e)
      setStatus({
        message: `Install failed (${details.slice(0, 80)}). Please retry.`,
        kind: "error"
      })
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {updateInfo ? (
              <Button
                aria-label="Install update"
                size="icon"
                onClick={handleInstall}
                disabled={installing}
                className="h-6 w-6 text-slate-400 hover:text-slate-200"
              >
                <Download className={cn("w-4 h-4", installing && "animate-bounce")} />
              </Button>
            ) : (
              <Button
                aria-label="Check for updates"
                size="icon"
                onClick={handleCheck}
                disabled={checking || installing}
                className="h-6 w-6 text-slate-400 hover:text-slate-200"
              >
                <RefreshCcw className={cn("w-4 h-4", checking && "animate-spin")} />
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent side="top">{updateInfo ? "Install update" : "Check for updates"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {status.message && (
        <span aria-live="polite" className={cn("truncate max-w-[140px] transition-colors", statusColour[status.kind])}>
          {status.message}
        </span>
      )}
    </div>
  )
}
