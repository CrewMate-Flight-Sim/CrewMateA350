mod joystick;
mod keyboard;

use std::collections::HashSet;
use std::sync::{Arc, Mutex, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::SPEECH_BRIDGE_STATE;
use joystick::Joysticks;

const POLL_INTERVAL: Duration = Duration::from_millis(10);
// SAPI only raises a result after trailing silence, so muting right on release drops the last command
const PTT_RELEASE_TAIL: Duration = Duration::from_millis(600);
const CAPTURE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum PovDir {
    Up,
    Right,
    Down,
    Left,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum JoystickControl {
    Button { index: u8 },
    Pov { index: u8, dir: PovDir },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum InputBinding {
    Keyboard {
        vk: u16,
        label: String,
    },
    #[serde(rename_all = "camelCase")]
    Joystick {
        device_guid: String,
        device_name: String,
        control: JoystickControl,
        label: String,
    },
}

#[derive(Default)]
struct Bindings {
    ptt: Option<InputBinding>,
    toggle: Option<InputBinding>,
    capture: Option<u64>,
    capture_seq: u64,
}

// PTT is only mute/unmute, so both the user's mic switch and the PTT button feed the one sidecar flag
#[derive(Default)]
struct MicGate {
    user_muted: bool,
    ptt_mode: bool,
    ptt_open: bool,
}

impl MicGate {
    fn apply(&self) {
        let muted = self.user_muted || (self.ptt_mode && !self.ptt_open);
        if let Some(bridge) = SPEECH_BRIDGE_STATE.get() {
            bridge.send_config(&format!(r#"{{"muted":{}}}"#, muted));
        }
    }

    fn set_ptt_open(&mut self, open: bool) {
        if self.ptt_open != open {
            self.ptt_open = open;
            if self.ptt_mode {
                self.apply();
            }
        }
    }
}

#[derive(Default, Clone)]
pub struct InputState {
    bindings: Arc<Mutex<Bindings>>,
    gate: Arc<Mutex<MicGate>>,
}

pub fn start(app: AppHandle, hwnd: isize) -> InputState {
    let state = InputState::default();
    let worker = state.clone();
    if let Err(e) = thread::Builder::new()
        .name("input".into())
        .spawn(move || run(app, hwnd, worker))
    {
        log::error!("[Input] Failed to start input thread: {e}");
    }
    state
}

struct Capture {
    id: u64,
    deadline: Instant,
    held_keys: HashSet<u16>,
    held_controls: HashSet<(String, JoystickControl)>,
}

enum CaptureOutcome {
    Captured(InputBinding),
    Cancelled,
}

impl Capture {
    // Anything already held when Set was clicked must be released first, or it would bind instantly
    fn start(id: u64, joysticks: &Joysticks) -> Self {
        Self {
            id,
            deadline: Instant::now() + CAPTURE_TIMEOUT,
            held_keys: keyboard::pressed_keys().into_iter().collect(),
            held_controls: pressed_controls(joysticks).into_iter().collect(),
        }
    }

    fn scan(&mut self, joysticks: &Joysticks) -> Option<CaptureOutcome> {
        let keys = keyboard::pressed_keys();
        self.held_keys.retain(|k| keys.contains(k));
        if let Some(&vk) = keys.iter().find(|k| !self.held_keys.contains(k)) {
            if vk == keyboard::VK_ESCAPE {
                return Some(CaptureOutcome::Cancelled);
            }
            return Some(CaptureOutcome::Captured(InputBinding::Keyboard {
                vk,
                label: keyboard::label(vk),
            }));
        }

        let controls = pressed_controls(joysticks);
        self.held_controls.retain(|c| controls.contains(c));
        let (guid, control) = controls
            .into_iter()
            .find(|c| !self.held_controls.contains(c))?;
        let device = joysticks.devices.iter().find(|d| d.guid == guid)?;
        let label = match control {
            JoystickControl::Button { index } => format!("{} · Button {}", device.name, index + 1),
            JoystickControl::Pov { index, dir } => {
                let hat = if index == 0 {
                    String::new()
                } else {
                    format!(" {}", index + 1)
                };
                format!("{} · Hat{hat} {dir:?}", device.name)
            }
        };
        Some(CaptureOutcome::Captured(InputBinding::Joystick {
            device_guid: guid,
            device_name: device.name.clone(),
            control,
            label,
        }))
    }
}

fn pressed_controls(joysticks: &Joysticks) -> Vec<(String, JoystickControl)> {
    joysticks
        .devices
        .iter()
        .flat_map(|d| d.state.pressed().into_iter().map(|c| (d.guid.clone(), c)))
        .collect()
}

fn is_down(binding: &InputBinding, joysticks: &Joysticks) -> bool {
    match binding {
        InputBinding::Keyboard { vk, .. } => keyboard::is_down(*vk),
        InputBinding::Joystick {
            device_guid,
            device_name,
            control,
            ..
        } => joysticks
            .find(device_guid, device_name)
            .is_some_and(|d| d.state.is_down(*control)),
    }
}

fn run(app: AppHandle, hwnd: isize, state: InputState) {
    let mut joysticks = Joysticks::new(hwnd);
    let mut capture: Option<Capture> = None;
    let mut ptt_was_down = false;
    let mut toggle_was_down = false;
    let mut last_toggle: Option<InputBinding> = None;
    let mut ptt_close_at: Option<Instant> = None;

    loop {
        thread::sleep(POLL_INTERVAL);

        let (ptt, toggle, capture_id) = {
            let b = state
                .bindings
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            (b.ptt.clone(), b.toggle.clone(), b.capture)
        };

        if let Some(id) = capture_id {
            if ptt_was_down || ptt_close_at.is_some() {
                ptt_was_down = false;
                ptt_close_at = None;
                let _ = app.emit("ptt_state", serde_json::json!({ "held": false }));
                lock_gate(&state).set_ptt_open(false);
            }

            if capture.as_ref().map(|c| c.id) != Some(id) {
                joysticks.enumerate_now();
                joysticks.sync(&[], true);
                joysticks.poll();
                capture = Some(Capture::start(id, &joysticks));
                continue;
            }

            joysticks.sync(&[], true);
            joysticks.poll();
            let Some(active) = capture.as_mut() else {
                continue;
            };
            let outcome = active.scan(&joysticks).or_else(|| {
                (Instant::now() >= active.deadline).then_some(CaptureOutcome::Cancelled)
            });
            let Some(outcome) = outcome else { continue };

            {
                let mut b = state
                    .bindings
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner);
                if b.capture == Some(id) {
                    b.capture = None;
                }
            }
            capture = None;
            match outcome {
                CaptureOutcome::Captured(binding) => {
                    log::info!("[Input] Captured {binding:?}");
                    let _ = app.emit("input_captured", binding);
                }
                CaptureOutcome::Cancelled => {
                    let _ = app.emit("input_capture_cancelled", ());
                }
            }
            continue;
        }
        capture = None;

        let wanted: Vec<(&str, &str)> = [ptt.as_ref(), toggle.as_ref()]
            .into_iter()
            .flatten()
            .filter_map(|b| match b {
                InputBinding::Joystick {
                    device_guid,
                    device_name,
                    ..
                } => Some((device_guid.as_str(), device_name.as_str())),
                InputBinding::Keyboard { .. } => None,
            })
            .collect();
        joysticks.sync(&wanted, false);
        joysticks.poll();

        let ptt_down = ptt.as_ref().is_some_and(|b| is_down(b, &joysticks));
        if ptt_down != ptt_was_down {
            ptt_was_down = ptt_down;
            log::info!("[Input] PTT {}", if ptt_down { "held" } else { "released" });
            let _ = app.emit("ptt_state", serde_json::json!({ "held": ptt_down }));
            if ptt_down {
                ptt_close_at = None;
                lock_gate(&state).set_ptt_open(true);
            } else {
                ptt_close_at = Some(Instant::now() + PTT_RELEASE_TAIL);
            }
        }
        if ptt_close_at.is_some_and(|t| Instant::now() >= t) {
            ptt_close_at = None;
            lock_gate(&state).set_ptt_open(false);
        }

        let toggle_down = toggle.as_ref().is_some_and(|b| is_down(b, &joysticks));
        // A freshly bound button is usually still held from the capture; that press must not flip the mic
        if toggle != last_toggle {
            last_toggle = toggle;
            toggle_was_down = toggle_down;
        }
        if toggle_down && !toggle_was_down {
            log::info!("[Input] Mic toggle pressed");
            let _ = app.emit("mic_toggle_pressed", ());
        }
        toggle_was_down = toggle_down;
    }
}

fn lock_gate(state: &InputState) -> std::sync::MutexGuard<'_, MicGate> {
    state.gate.lock().unwrap_or_else(PoisonError::into_inner)
}

#[tauri::command]
pub fn set_muted(state: tauri::State<'_, InputState>, muted: bool) {
    let mut gate = lock_gate(&state);
    gate.user_muted = muted;
    gate.apply();
}

#[tauri::command]
pub fn set_voice_mode(state: tauri::State<'_, InputState>, mode: String) {
    let mut gate = lock_gate(&state);
    gate.ptt_mode = mode == "ptt";
    log::info!("[Input] Voice mode: {mode}");
    gate.apply();
}

#[tauri::command]
pub fn set_mic_bindings(
    state: tauri::State<'_, InputState>,
    ptt: Option<InputBinding>,
    toggle: Option<InputBinding>,
) {
    let mut b = state
        .bindings
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    b.ptt = ptt;
    b.toggle = toggle;
}

#[tauri::command]
pub fn start_input_capture(state: tauri::State<'_, InputState>) {
    let mut b = state
        .bindings
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    b.capture_seq += 1;
    b.capture = Some(b.capture_seq);
}

#[tauri::command]
pub fn cancel_input_capture(state: tauri::State<'_, InputState>) {
    state
        .bindings
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .capture = None;
}
