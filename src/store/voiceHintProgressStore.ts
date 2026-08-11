import { create } from "zustand"

interface VoiceHintProgressState {
  lastCompletedChecklistId: string | null
  lastCompletedFlowId: string | null
  /** Incremented when we detect ground→air; optional future use for stale guards */
  legEpoch: number

  recordChecklistCompleted: (id: string) => void
  recordFlowCompleted: (id: string) => void
  /** Call when aircraft becomes airborne — no longer clears milestones, since
   *  airborne phases (initial_climb, approach, short_final) depend on lastFl/lastCl
   *  still holding "takeoff"/"approach"/"landing" after rotation */
  onAirborneTransition: () => void
  /** After shutdown flow or engines cold on ground — full reset for next turnaround */
  resetForColdGround: () => void
}

export const useVoiceHintProgressStore = create<VoiceHintProgressState>()((set) => ({
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
