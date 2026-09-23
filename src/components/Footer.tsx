import { getVersion } from "@tauri-apps/api/app"
import { useState, useEffect } from "react"

import { UpdateChecker } from "./UpdateChecker"

export function Footer() {
  const [version, setVersion] = useState("")

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion()
        setVersion(appVersion)
      } catch (error) {
        console.error("[Footer] Failed to get app version:", error)
        setVersion("0.1.2")
      }
    }

    fetchVersion()
  }, [])

  return (
    <div className="w-full border-t border-slate-800 px-2 py-1 flex items-center justify-between text-xs text-slate-400 bg-black">
      <div className="flex items-center gap-2">
        <UpdateChecker />
      </div>
      <span className="font-mono ml-2">v{version}</span>
    </div>
  )
}
