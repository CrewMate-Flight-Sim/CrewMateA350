use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::time::sleep;

#[cfg(windows)]
mod windows_job {
    #![allow(non_snake_case)]

    use std::os::windows::io::RawHandle;
    use std::ptr;

    extern "system" {
        fn CreateJobObjectW(
            lpJobAttributes: *mut std::ffi::c_void,
            lpName: *const u16,
        ) -> RawHandle;
        fn SetInformationJobObject(
            hJob: RawHandle,
            JobObjectInfoClass: i32,
            lpJobObjectInfo: *mut std::ffi::c_void,
            cbJobObjectInfoLength: u32,
        ) -> i32;
        fn AssignProcessToJobObject(hJob: RawHandle, hProcess: RawHandle) -> i32;
        fn CloseHandle(hObject: RawHandle) -> i32;
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> RawHandle;
    }

    const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: i32 = 9;
    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x00002000;
    const PROCESS_SET_QUOTA: u32 = 0x0100;
    const PROCESS_TERMINATE: u32 = 0x0001;

    #[repr(C)]
    struct IoCounters {
        ReadOperationCount: u64,
        WriteOperationCount: u64,
        OtherOperationCount: u64,
        ReadTransferCount: u64,
        WriteTransferCount: u64,
        OtherTransferCount: u64,
    }

    #[repr(C)]
    struct JobObjectBasicLimitInformation {
        PerProcessUserTimeLimit: i64,
        PerJobUserTimeLimit: i64,
        LimitFlags: u32,
        MinimumWorkingSetSize: usize,
        MaximumWorkingSetSize: usize,
        ActiveProcessLimit: u32,
        Affinity: usize,
        PriorityClass: u32,
        SchedulingClass: u32,
    }

    #[repr(C)]
    struct JobObjectExtendedLimitInformation {
        BasicLimitInformation: JobObjectBasicLimitInformation,
        IoInfo: IoCounters,
        ProcessMemoryLimit: usize,
        JobMemoryLimit: usize,
        PeakProcessMemoryUsed: usize,
        PeakJobMemoryUsed: usize,
    }

    pub struct Job {
        handle: RawHandle,
    }

    unsafe impl Send for Job {}
    unsafe impl Sync for Job {}

    impl Job {
        pub fn new() -> Option<Self> {
            unsafe {
                let handle = CreateJobObjectW(ptr::null_mut(), ptr::null_mut());
                if handle.is_null() {
                    return None;
                }

                let mut info = JobObjectExtendedLimitInformation {
                    BasicLimitInformation: JobObjectBasicLimitInformation {
                        PerProcessUserTimeLimit: 0,
                        PerJobUserTimeLimit: 0,
                        LimitFlags: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
                        MinimumWorkingSetSize: 0,
                        MaximumWorkingSetSize: 0,
                        ActiveProcessLimit: 0,
                        Affinity: 0,
                        PriorityClass: 0,
                        SchedulingClass: 0,
                    },
                    IoInfo: IoCounters {
                        ReadOperationCount: 0,
                        WriteOperationCount: 0,
                        OtherOperationCount: 0,
                        ReadTransferCount: 0,
                        WriteTransferCount: 0,
                        OtherTransferCount: 0,
                    },
                    ProcessMemoryLimit: 0,
                    JobMemoryLimit: 0,
                    PeakProcessMemoryUsed: 0,
                    PeakJobMemoryUsed: 0,
                };

                let result = SetInformationJobObject(
                    handle,
                    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                    &mut info as *mut _ as *mut _,
                    std::mem::size_of::<JobObjectExtendedLimitInformation>() as u32,
                );

                if result == 0 {
                    CloseHandle(handle);
                    return None;
                }

                Some(Job { handle })
            }
        }

        pub fn assign_process(&self, pid: u32) {
            unsafe {
                let process_handle = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
                if process_handle.is_null() {
                    return;
                }

                let _ = AssignProcessToJobObject(self.handle, process_handle);
                CloseHandle(process_handle);
            }
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.handle);
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SpeechInputDevice {
    pub index: u32,
    pub name: String,
    pub is_default: bool,
}

/// All state shared between the bridge and every spawned sidecar's event
/// loop / restart logic. Cloning is cheap: a handful of `Arc` bumps plus a
/// `PathBuf` and an `AppHandle` clone.
///
/// Bundling these together (instead of threading ~9 separate `Arc<...>`
/// parameters through `spawn_sidecar` / `schedule_restart` / the event loop)
/// is what let the two previously-duplicated event-handling blocks collapse
/// into the single `spawn_event_loop` function below.
#[derive(Clone)]
struct SidecarShared {
    app: tauri::AppHandle,
    grammar_path: PathBuf,
    child: Arc<Mutex<Option<CommandChild>>>,
    last_error: Arc<Mutex<Option<String>>>,
    input_devices: Arc<Mutex<Vec<SpeechInputDevice>>>,
    selected_input_device: Arc<Mutex<Option<String>>>,
    is_shutting_down: Arc<AtomicBool>,
    active_instance_id: Arc<AtomicU64>,
    // Tracks consecutive restart failures. Reset to 0 once a spawned instance
    // survives past STABILITY_WINDOW without terminating, so an isolated crash
    // months apart doesn't count toward the same MAX_ATTEMPTS ceiling as a
    // genuine crash loop.
    restart_attempt: Arc<AtomicU32>,
    #[cfg(windows)]
    job: Arc<Mutex<Option<windows_job::Job>>>,
}

impl SidecarShared {
    fn record_error(&self, message: &str) {
        if let Ok(mut e) = self.last_error.lock() {
            *e = Some(message.to_string());
        }
        let _ = self.app.emit(
            "speech_engine_error",
            serde_json::json!({ "type": "error", "message": message }),
        );
    }
}

pub struct SpeechBridge {
    shared: SidecarShared,
}

impl SpeechBridge {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        // Resolve grammar.xml from the Tauri resource directory.
        // In dev mode this is src-tauri/bin/grammar.xml; in production it is the
        // bundled resource path — either way the sidecar receives an absolute path.
        let grammar_path = Self::resolve_grammar_path(&app_handle);

        let shared = SidecarShared {
            app: app_handle,
            grammar_path,
            child: Arc::new(Mutex::new(None)),
            last_error: Arc::new(Mutex::new(None)),
            input_devices: Arc::new(Mutex::new(Vec::new())),
            selected_input_device: Arc::new(Mutex::new(None)),
            is_shutting_down: Arc::new(AtomicBool::new(false)),
            active_instance_id: Arc::new(AtomicU64::new(0)),
            restart_attempt: Arc::new(AtomicU32::new(0)),
            #[cfg(windows)]
            job: Arc::new(Mutex::new(windows_job::Job::new())),
        };

        let bridge = Self { shared };

        if let Err(message) = bridge.spawn_sidecar(None) {
            bridge.shared.record_error(&message);
            log::error!("[Speech] {}", message);
        }
        bridge
    }

    fn resolve_grammar_path(handle: &tauri::AppHandle) -> PathBuf {
        if let Ok(resource_dir) = handle.path().resource_dir() {
            return resource_dir.join("bin").join("grammar.xml");
        }
        log::warn!("[Speech] Resource dir unavailable, using fallback grammar path");
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|pp| pp.join("bin").join("grammar.xml")))
            .unwrap_or_else(|| PathBuf::from("bin").join("grammar.xml"))
    }

    /// How long a freshly (re)spawned sidecar must stay alive before we treat
    /// it as "healthy" and reset the consecutive-failure counter back to 0.
    const STABILITY_WINDOW: Duration = Duration::from_secs(10);

    /// Schedules a reset of `restart_attempt` back to 0 after `STABILITY_WINDOW`,
    /// but only if `instance_id` is still the active instance at that point
    /// (i.e. it didn't terminate again in the meantime).
    fn schedule_stability_reset(shared: SidecarShared, instance_id: u64) {
        tauri::async_runtime::spawn(async move {
            sleep(SpeechBridge::STABILITY_WINDOW).await;
            if instance_id == shared.active_instance_id.load(Ordering::SeqCst) {
                shared.restart_attempt.store(0, Ordering::SeqCst);
            }
        });
    }

    fn spawn_sidecar(&self, input_device: Option<&str>) -> Result<(), String> {
        let mut args = vec![self.shared.grammar_path.to_string_lossy().to_string()];
        if let Some(device) = input_device {
            args.push(device.to_string());
        }

        let (rx, new_child) = self
            .shared
            .app
            .shell()
            .sidecar("copilot_speech")
            .map_err(|e| format!("Missing copilot_speech sidecar: {e}"))?
            .args(args)
            .spawn()
            .map_err(|e| format!("Failed to spawn speech recognition sidecar: {e}"))?;
        let instance_id = self
            .shared
            .active_instance_id
            .fetch_add(1, Ordering::SeqCst)
            + 1;

        self.shared.is_shutting_down.store(false, Ordering::SeqCst);
        if let Ok(mut d) = self.shared.selected_input_device.lock() {
            *d = input_device
                .filter(|d| !d.is_empty() && *d != "default")
                .map(|s| s.to_string());
        }

        let pid = new_child.pid();
        if let Ok(mut g) = self.shared.child.lock() {
            *g = Some(new_child);
        }

        #[cfg(windows)]
        if let Ok(job_lock) = self.shared.job.lock() {
            if let Some(ref job) = *job_lock {
                job.assign_process(pid);
            }
        }

        // This is a fresh, explicitly-requested spawn (app start or device
        // change), not a crash restart — start the counter at a clean slate.
        self.shared.restart_attempt.store(0, Ordering::SeqCst);
        SpeechBridge::schedule_stability_reset(self.shared.clone(), instance_id);

        spawn_event_loop(rx, instance_id, self.shared.clone());

        Ok(())
    }

    fn schedule_restart(shared: SidecarShared, input_device: Option<String>, attempt: u32) {
        const MAX_ATTEMPTS: u32 = 5;
        if attempt >= MAX_ATTEMPTS {
            let message = format!(
                "Speech engine failed to restart after {} attempts; please restart the app.",
                MAX_ATTEMPTS
            );
            shared.record_error(&message);
            return;
        }

        tauri::async_runtime::spawn(async move {
            let backoff_secs = 1u64 << attempt.min(4);
            sleep(Duration::from_secs(backoff_secs)).await;

            if shared.is_shutting_down.load(Ordering::SeqCst) {
                return;
            }
            let expected_instance = shared.active_instance_id.load(Ordering::SeqCst);

            let mut args = vec![shared.grammar_path.to_string_lossy().to_string()];
            if let Some(device) = &input_device {
                args.push(device.clone());
            }

            let spawn_result = shared
                .app
                .shell()
                .sidecar("copilot_speech")
                .and_then(|cmd| cmd.args(args).spawn());

            match spawn_result {
                Ok((rx, new_child)) => {
                    // Ignore stale restart jobs scheduled by an old instance.
                    if expected_instance != shared.active_instance_id.load(Ordering::SeqCst) {
                        let _ = new_child.kill();
                        return;
                    }
                    let instance_id = shared.active_instance_id.fetch_add(1, Ordering::SeqCst) + 1;
                    shared.is_shutting_down.store(false, Ordering::SeqCst);
                    let pid = new_child.pid();
                    if let Ok(mut c) = shared.child.lock() {
                        *c = Some(new_child);
                    }
                    #[cfg(windows)]
                    if let Ok(job_lock) = shared.job.lock() {
                        if let Some(ref job) = *job_lock {
                            job.assign_process(pid);
                        }
                    }
                    if let Ok(mut d) = shared.selected_input_device.lock() {
                        *d = input_device.clone();
                    }
                    let _ = shared.app.emit(
                        "speech_engine_status",
                        serde_json::json!({
                            "type": "status",
                            "status": "ready",
                            "details": { "restarted": true }
                        }),
                    );

                    // This restart succeeded in spawning — start a stability
                    // timer so an isolated crash doesn't permanently inflate
                    // the failure count used against MAX_ATTEMPTS.
                    SpeechBridge::schedule_stability_reset(shared.clone(), instance_id);

                    spawn_event_loop(rx, instance_id, shared.clone());
                }
                Err(e) => {
                    let message = format!(
                        "Speech sidecar restart attempt {} failed: {}",
                        attempt + 1,
                        e
                    );
                    shared.record_error(&message);
                    SpeechBridge::schedule_restart(
                        shared.clone(),
                        input_device.clone(),
                        attempt + 1,
                    );
                }
            }
        });
    }

    pub fn last_error(&self) -> Option<String> {
        self.shared.last_error.lock().ok().and_then(|e| e.clone())
    }

    pub fn get_input_devices(&self) -> Vec<SpeechInputDevice> {
        self.shared
            .input_devices
            .lock()
            .map(|g| g.clone())
            .unwrap_or_default()
    }

    pub fn send_config(&self, json: &str) {
        if let Ok(mut g) = self.shared.child.lock() {
            if let Some(ref mut c) = *g {
                let _ = c.write(format!("{}\n", json).as_bytes());
            }
        }
    }

    /// Kill the current sidecar and respawn it with the given input device name.
    /// Pass `None` (or `Some("default")`) to fall back to the system default mic.
    pub fn restart_with_device(&self, device: Option<String>) {
        log::info!(
            "[Speech] Restarting sidecar with input device: {:?}",
            device
        );
        if let Ok(mut d) = self.shared.input_devices.lock() {
            d.clear();
        }
        self.shutdown();
        let arg = device.filter(|d| !d.is_empty() && d != "default");
        if let Err(message) = self.spawn_sidecar(arg.as_deref()) {
            self.shared.record_error(&message);
            log::error!("[Speech] {}", message);
        }
    }

    pub fn shutdown(&self) {
        self.shared.is_shutting_down.store(true, Ordering::SeqCst);
        // Invalidate currently tracked instance so stale termination events
        // cannot trigger a second spawn.
        self.shared
            .active_instance_id
            .fetch_add(1, Ordering::SeqCst);
        if let Ok(mut g) = self.shared.child.lock() {
            if let Some(c) = g.take() {
                let _ = c.kill();
            }
        }
    }
}

impl Drop for SpeechBridge {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// Drives one spawned sidecar's stdout/stderr/termination events until it
/// stops being the active instance or the process exits.
///
/// This is the piece that used to be duplicated between the initial spawn
/// and every crash-triggered restart. Unifying it also fixes a small bug
/// that duplication had introduced: the "restarting" status event now
/// always fires before a restart is scheduled, instead of only on the
/// *first* crash and silently not on subsequent ones.
fn spawn_event_loop(
    mut rx: tauri::async_runtime::Receiver<CommandEvent>,
    instance_id: u64,
    shared: SidecarShared,
) {
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => handle_stdout_line(&line, &shared),
                CommandEvent::Stderr(line) => {
                    log::error!("[Speech] Stderr: {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(status) => {
                    log::error!("[Speech] Sidecar terminated: code={:?}", status.code);
                    let is_current_instance =
                        instance_id == shared.active_instance_id.load(Ordering::SeqCst);
                    if is_current_instance && !shared.is_shutting_down.load(Ordering::SeqCst) {
                        let selected = shared
                            .selected_input_device
                            .lock()
                            .ok()
                            .and_then(|d| d.clone());
                        let _ = shared.app.emit(
                            "speech_engine_status",
                            serde_json::json!({
                                "type": "status",
                                "status": "restarting",
                                "details": {
                                    "reason": "sidecar_terminated",
                                    "code": status.code,
                                }
                            }),
                        );
                        let attempt = shared.restart_attempt.fetch_add(1, Ordering::SeqCst) + 1;
                        SpeechBridge::schedule_restart(shared.clone(), selected, attempt);
                    }
                    break;
                }
                _ => {}
            }
        }
    });
}

fn handle_stdout_line(line: &[u8], shared: &SidecarShared) {
    let Ok(value) = serde_json::from_slice::<Value>(line) else {
        log::warn!(
            "[Speech] Non-JSON stdout: {}",
            String::from_utf8_lossy(line)
        );
        return;
    };

    match value["type"].as_str().unwrap_or("") {
        "speech" => {
            log::info!(
                "[Speech] Recognized: \"{}\" (confidence: {:.2})",
                value["text"].as_str().unwrap_or("?"),
                value["confidence"].as_f64().unwrap_or(0.0)
            );
            let _ = shared.app.emit("speech_recognized", value);
        }
        "speech_unrecognized" => {
            log::debug!("[Speech] Unrecognized utterance");
            let _ = shared.app.emit("speech_recognized", value);
        }
        "status" => {
            log::info!("[Speech] Engine status: {}", value);
            let _ = shared.app.emit("speech_engine_status", value);
        }
        "error" => {
            let message = value["message"]
                .as_str()
                .unwrap_or("Unknown speech engine error")
                .to_string();
            if let Ok(mut e) = shared.last_error.lock() {
                *e = Some(message);
            }
            log::error!("[Speech] Engine error: {}", value);
            let _ = shared.app.emit("speech_engine_error", value);
        }
        "inputDevices" => {
            if let Some(arr) = value["devices"].as_array() {
                let devices: Vec<SpeechInputDevice> = arr
                    .iter()
                    .filter_map(|d| {
                        let index = d["index"].as_u64()? as u32;
                        let name = d["name"].as_str()?.to_string();
                        let is_default = d["isDefault"].as_bool().unwrap_or(false);
                        Some(SpeechInputDevice {
                            index,
                            name,
                            is_default,
                        })
                    })
                    .collect();

                if let Ok(mut stored) = shared.input_devices.lock() {
                    *stored = devices;
                }
            }
        }
        _ => {}
    }
}

#[tauri::command]
pub fn get_speech_input_devices(
    state: tauri::State<'_, crate::SpeechBridgeState>,
) -> Vec<SpeechInputDevice> {
    state.inner().0.get_input_devices()
}
