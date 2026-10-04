import { create } from "zustand"

interface VoiceHintProgressStore {
  lastCompletedChecklistId: string | null
  lastCompletedFlowId: string | null
  /** Incremented when we detect ground→air; optional future use for stale guards */
  legEpoch: number

  recordChecklistCompleted: (id: string) => void
  recordFlowCompleted: (id: string) => void
  // Keeps the milestones: the airborne hint phases still need lastFl/lastCl from before rotation
  onAirborneTransition: () => void
  /** After shutdown flow or engines cold on ground — full reset for next turnaround */
  resetForColdGround: () => void
}

export const useVoiceHintProgressStore = create<VoiceHintProgressStore>()((set) => ({
  lastCompletedChecklistId: null,
  lastCompletedFlowId: null,
  legEpoch: 0,

  recordChecklistCompleted: (id) =>
    set({
      lastCompletedChecklistId: id
    }),

  recordFlowCompleted: (id) =>
    set({
      lastCompletedFlowId: id
    }),

  onAirborneTransition: () =>
    set((s) => ({
      legEpoch: s.legEpoch + 1
    })),

  resetForColdGround: () =>
    set({
      lastCompletedChecklistId: null,
      lastCompletedFlowId: null
    })
}))
