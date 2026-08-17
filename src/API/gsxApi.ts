//
// Thin client for GSX's Couatl Remote API v2 (WebSocket/JSON, local only).
// Docs: GSX manual, "Couatl Remote API v2 — Developer Guide" section.
//

type GsxCommandVerb = "service.trigger" | "menu.pick" | "command.run" | "input.submit" | "input.cancel"

interface GsxService {
  id: string
  state: string
  [k: string]: unknown
}

interface GsxState {
  services?: GsxService[]
  menu?: { entries?: string[]; disabled?: boolean[] } | null
  gsxRunning?: boolean
  engine?: { gsxRunning?: boolean }
  [k: string]: unknown
}

function setDeepProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.replace(/^\//, "").split("/")
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

function isGsxActive(state: GsxState, ws: WebSocket | null): boolean {
  if (ws?.readyState !== WebSocket.OPEN) return false
  if (state.gsxRunning === true) return true

  const engineObj = state.engine as { gsxRunning?: boolean } | undefined
  if (engineObj?.gsxRunning === true) return true

  return state.gsxRunning !== false
}

class GsxRemoteClient {
  private ws: WebSocket | null = null
  private state: GsxState = {}
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private cmdId = 0
  private pending = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()
  private port = 8744
  private reconnectDelay = 2000
  private maxReconnectDelay = 30000

  /** Call once at app start. Safe to call again — no-ops if already connected/connecting. */
  connect(port = 8744) {
    this.port = port
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return

    this.ws = new WebSocket(`ws://127.0.0.1:${this.port}`)

    this.ws.onopen = () => {
      this.resetReconnectDelay()
      this.send({ type: "subscribe", channels: ["state"] })
    }

    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as Record<string, unknown>

      switch (msg.type) {
        case "snapshot": {
          this.state = { ...this.state, ...msg }
          const engine = msg.engine as { gsxRunning?: boolean } | undefined
          if (engine?.gsxRunning !== undefined) {
            this.state.gsxRunning = engine.gsxRunning
          }
          break
        }
        case "patch": {
          if (typeof msg.path === "string") {
            setDeepProperty(this.state, msg.path, msg.value)
            if (msg.path === "/engine/gsxRunning" || msg.path === "/gsxRunning") {
              this.state.gsxRunning = Boolean(msg.value)
            }
          }
          break
        }
        case "event": {
          if (msg.topic === "engine" && typeof msg.gsxRunning === "boolean") {
            this.state.gsxRunning = msg.gsxRunning
          }
          break
        }
        case "result": {
          const msgId = typeof msg.id === "string" ? msg.id : undefined
          const entry = msgId ? this.pending.get(msgId) : undefined
          if (entry && msgId) {
            this.pending.delete(msgId)
            if (msg.ok) {
              entry.resolve()
            } else {
              const errObj = msg.error as { code?: string } | undefined
              entry.reject(new Error(errObj?.code ?? "gsx_command_failed"))
            }
          }
          break
        }
      }
    }

    this.ws.onclose = () => {
      this.ws = null
      this.increaseReconnectDelay()
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(this.port)
    }, this.reconnectDelay)
  }

  private resetReconnectDelay() {
    this.reconnectDelay = 2000
  }

  private increaseReconnectDelay() {
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
  }

  private send(obj: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj))
  }

  private command(verb: GsxCommandVerb, args: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isGsxActive(this.state, this.ws)) {
        reject(new Error("gsx_not_running"))
        return
      }
      const id = `c-${++this.cmdId}`
      this.pending.set(id, { resolve, reject })
      this.send({ type: "command", id, verb, args })

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error("gsx_command_timeout"))
        }
      }, 5000)
    })
  }

  /** Request a service by its canonical id, e.g. "Departure" (pushback), "OperateJetways". */
  triggerService(id: string) {
    return this.command("service.trigger", { service: id })
  }

  /** Pick an entry from the currently-open GSX menu, by index. */
  pickMenu(index: number) {
    return this.command("menu.pick", { index })
  }

  getServiceState(id: string): string | undefined {
    return this.state.services?.find((s) => s.id === id)?.state
  }

  isRunning() {
    return isGsxActive(this.state, this.ws)
  }
}

export const gsxClient = new GsxRemoteClient()
