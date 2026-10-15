export type VoiceMode = "continuous" | "ptt"

type PovDirection = "up" | "right" | "down" | "left"

type JoystickControl = { type: "button"; index: number } | { type: "pov"; index: number; dir: PovDirection }

export type InputBinding =
  | { kind: "keyboard"; vk: number; label: string }
  | { kind: "joystick"; deviceGuid: string; deviceName: string; control: JoystickControl; label: string }
