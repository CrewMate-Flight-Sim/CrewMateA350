import { create } from "zustand"

interface RtoStore {
  /** Incremented each time the pilot calls "stop". Hooks compare against last seen value. */
  count: number
  trigger: () => void
}

export const useRtoStore = create<RtoStore>()((set) => ({
  count: 0,
  trigger: () => set((s) => ({ count: s.count + 1 }))
}))
