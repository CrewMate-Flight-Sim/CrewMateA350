import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_PTT_SHORTCUT,
  formatShortcutForDisplay,
  getShortcutToggleTransition,
  normalizePttShortcut
} from "../src/voice/pushToTalkState.ts"

describe("voice shortcut state", () => {
  it("uses Ctrl+Shift+M as the default shortcut", () => {
    assert.equal(DEFAULT_PTT_SHORTCUT, "CommandOrControl+Shift+M")
    assert.equal(formatShortcutForDisplay(DEFAULT_PTT_SHORTCUT), "Ctrl+Shift+M")
  })

  it("toggles listening once per shortcut press", () => {
    const firstPress = getShortcutToggleTransition(false, false, "Pressed")
    assert.deepEqual(firstPress, { isPressed: true, voiceEnabled: true })

    const repeatedPress = getShortcutToggleTransition(firstPress.isPressed, firstPress.voiceEnabled, "Pressed")
    assert.deepEqual(repeatedPress, { isPressed: true })

    const release = getShortcutToggleTransition(repeatedPress.isPressed, firstPress.voiceEnabled, "Released")
    assert.deepEqual(release, { isPressed: false })

    const secondPress = getShortcutToggleTransition(release.isPressed, firstPress.voiceEnabled, "Pressed")
    assert.deepEqual(secondPress, { isPressed: true, voiceEnabled: false })
  })

  it("normalizes old persisted shortcut aliases", () => {
    assert.equal(normalizePttShortcut("CmdOrCtrl+Shift+Space"), "CommandOrControl+Shift+M")
    assert.equal(normalizePttShortcut("CommandOrControl+Shift+Space"), "CommandOrControl+Shift+M")
    assert.equal(normalizePttShortcut("m"), "CommandOrControl+Shift+M")
    assert.equal(normalizePttShortcut("Ctrl+Shift+M"), "CommandOrControl+Shift+M")
  })
})
