export type FlowConditionValue = number | string | boolean

export type FlowCondition =
  | { read: string; one_of: FlowConditionValue[] }
  | { option: string; one_of: FlowConditionValue[] }

export interface FlowStep {
  label: string
  read: string
  on: string
  expect: number | string
  hold_ms?: number
  wait_ms?: number
  skip_verify?: boolean
  skip_delay?: boolean
  sound_on_execute?: string
  sound_after_execute?: string
  only_if?: FlowCondition
  until?: "at_least" | "at_most"
  release?: string
  timeout_ms?: number
}

export interface Flow {
  id: string
  name: string
  steps: FlowStep[]
  sound_start?: string
  sound_end?: string
}

export type StepStatus = "pending" | "executing" | "verifying" | "done" | "skipped" | "failed"

export type FlowExecutionState = "idle" | "running" | "completed" | "error" | "aborted"
