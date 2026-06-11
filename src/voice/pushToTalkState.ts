export type PttShortcutState = "Pressed" | "Released"

export type PttStateTransition = {
  isPressed: boolean
  voiceEnabled?: boolean
}

export const DEFAULT_PTT_SHORTCUT = "CommandOrControl+Shift+M"
export const PTT_RELEASE_MUTE_DELAY_MS = 1000

const oldDefaultShortcuts = new Set(["CommandOrControl+Shift+Space", "M"])

export const normalizePttShortcut = (shortcut: string): string => {
  const normalized = shortcut
    .trim()
    .replace(/^CmdOrCtrl\+/i, "CommandOrControl+")
    .replace(/^Ctrl\+/i, "CommandOrControl+")
  const shortcutName = normalized.length === 1 ? normalized.toUpperCase() : normalized

  if (!shortcutName || oldDefaultShortcuts.has(shortcutName)) {
    return DEFAULT_PTT_SHORTCUT
  }

  return shortcutName
}

export const formatShortcutForDisplay = (shortcut: string): string =>
  normalizePttShortcut(shortcut).replace(/^CommandOrControl\+/i, "Ctrl+")

export const getPttStateTransition = (isPressed: boolean, state: PttShortcutState): PttStateTransition => {
  if (state === "Released") {
    return { isPressed: false }
  }

  return isPressed ? { isPressed } : { isPressed: true, voiceEnabled: true }
}

export const getContinuousShortcutTransition = (
  isPressed: boolean,
  voiceEnabled: boolean,
  state: PttShortcutState
): PttStateTransition => {
  if (state === "Released") {
    return { isPressed: false }
  }

  return isPressed ? { isPressed } : { isPressed: true, voiceEnabled: !voiceEnabled }
}
