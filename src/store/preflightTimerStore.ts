import { create } from "zustand"

import timelineData from "@/data/preflight_timeline.json"
import { useFoPresenceStore } from "@/store/foPresenceStore"

export interface TimelineEvent {
  minuteMark: number
  label: string
  type: "flow" | "reminder" | "sound"
  flowId?: string
  sound?: string
}

interface PreflightTimerStore {
  isRunning: boolean
  remainingSeconds: number
  events: TimelineEvent[]
  firedMarks: Set<number>
  currentEvent: string | null
  queuedEvents: TimelineEvent[]

  start: () => void
  reset: () => void
  skipMinute: () => void
  tick: () => void
  setCurrentEvent: (label: string | null) => void
  markFired: (minuteMark: number) => void
  enqueueEvent: (event: TimelineEvent) => void
  dequeueEvent: () => TimelineEvent | undefined
}

const TOTAL_SECONDS = Math.max(...timelineData.map((e) => e.minuteMark)) * 60

export const usePreflightTimerStore = create<PreflightTimerStore>()((set, get) => ({
  isRunning: false,
  remainingSeconds: TOTAL_SECONDS,
  events: timelineData as TimelineEvent[],
  firedMarks: new Set<number>(),
  currentEvent: null,
  queuedEvents: [],

  start: () => {
    useFoPresenceStore.getState().deactivate()
    set({
      isRunning: true,
      remainingSeconds: TOTAL_SECONDS,
      firedMarks: new Set(),
      queuedEvents: [],
      currentEvent: null
    })
  },

  reset: () => {
    useFoPresenceStore.getState().deactivate()
    set({
      isRunning: false,
      remainingSeconds: TOTAL_SECONDS,
      firedMarks: new Set(),
      queuedEvents: [],
      currentEvent: null
    })
  },

  skipMinute: () => {
    const { remainingSeconds, isRunning } = get()
    if (!isRunning) return
    const next = Math.max(0, remainingSeconds - 60)
    set({ remainingSeconds: next })
    if (next === 0) set({ isRunning: false })
  },

  tick: () => {
    const { remainingSeconds, isRunning } = get()
    if (!isRunning) return
    const next = remainingSeconds - 1
    if (next <= 0) {
      set({ remainingSeconds: 0, isRunning: false })
    } else {
      set({ remainingSeconds: next })
    }
  },

  setCurrentEvent: (label) => set({ currentEvent: label }),

  markFired: (minuteMark) => {
    const { firedMarks } = get()
    const next = new Set(firedMarks)
    next.add(minuteMark)
    set({ firedMarks: next })
  },

  enqueueEvent: (event) => {
    set((state) => ({ queuedEvents: [...state.queuedEvents, event] }))
  },

  dequeueEvent: () => {
    const { queuedEvents } = get()
    if (queuedEvents.length === 0) return undefined
    const [first, ...rest] = queuedEvents
    set({ queuedEvents: rest })
    return first
  }
}))
