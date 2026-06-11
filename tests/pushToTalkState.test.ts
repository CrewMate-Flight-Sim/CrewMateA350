import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_PTT_SHORTCUT,
  formatShortcutForDisplay,
  getContinuousShortcutTransition,
  getPttStateTransition,
  normalizePttShortcut,
  PTT_RELEASE_MUTE_DELAY_MS
} from "../src/voice/pushToTalkState.ts"

describe("voice shortcut state", () => {
  it("uses Ctrl+Shift+M as the default shortcut", () => {
    assert.equal(DEFAULT_PTT_SHORTCUT, "CommandOrControl+Shift+M")
    assert.equal(formatShortcutForDisplay(DEFAULT_PTT_SHORTCUT), "Ctrl+Shift+M")
  })

  it("unmutes on press and marks release without immediate mute", () => {
    const firstPress = getPttStateTransition(false, "Pressed")
    assert.deepEqual(firstPress, { isPressed: true, voiceEnabled: true })

    const repeatedPress = getPttStateTransition(firstPress.isPressed, "Pressed")
    assert.deepEqual(repeatedPress, { isPressed: true })

    const release = getPttStateTransition(repeatedPress.isPressed, "Released")
    assert.deepEqual(release, { isPressed: false })

    const secondPress = getPttStateTransition(release.isPressed, "Pressed")
    assert.deepEqual(secondPress, { isPressed: true, voiceEnabled: true })
  })

  it("ignores release when the shortcut was not held", () => {
    const release = getPttStateTransition(false, "Released")
    assert.deepEqual(release, { isPressed: false })
  })

  it("uses a one second post-release mute delay in PTT mode", () => {
    assert.equal(PTT_RELEASE_MUTE_DELAY_MS, 1000)
  })

  it("toggles listening once per shortcut press in continuous mode", () => {
    const firstPress = getContinuousShortcutTransition(false, false, "Pressed")
    assert.deepEqual(firstPress, { isPressed: true, voiceEnabled: true })

    const repeatedPress = getContinuousShortcutTransition(firstPress.isPressed, firstPress.voiceEnabled!, "Pressed")
    assert.deepEqual(repeatedPress, { isPressed: true })

    const release = getContinuousShortcutTransition(repeatedPress.isPressed, firstPress.voiceEnabled!, "Released")
    assert.deepEqual(release, { isPressed: false })

    const secondPress = getContinuousShortcutTransition(release.isPressed, firstPress.voiceEnabled!, "Pressed")
    assert.deepEqual(secondPress, { isPressed: true, voiceEnabled: false })
  })

  it("normalizes old persisted shortcut aliases", () => {
    assert.equal(normalizePttShortcut("CmdOrCtrl+Shift+Space"), "CommandOrControl+Shift+M")
    assert.equal(normalizePttShortcut("CommandOrControl+Shift+Space"), "CommandOrControl+Shift+M")
    assert.equal(normalizePttShortcut("m"), "CommandOrControl+Shift+M")
    assert.equal(normalizePttShortcut("Ctrl+Shift+M"), "CommandOrControl+Shift+M")
  })
})
