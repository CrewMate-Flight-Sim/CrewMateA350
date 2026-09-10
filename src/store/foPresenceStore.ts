import { create } from "zustand"

// Tracks whether the FO is away from the flight deck (out on the walkaround)

interface FoPresenceStore {
  isActive: boolean
  activate: () => void
  deactivate: () => void
}

export const useFoPresenceStore = create<FoPresenceStore>()((set) => ({
  isActive: false,
  activate: () => set({ isActive: true }),
  deactivate: () => set({ isActive: false })
}))
