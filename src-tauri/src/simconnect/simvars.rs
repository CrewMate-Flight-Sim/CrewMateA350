use anyhow::Result;
use log::info;
use msfs::sys;
use std::collections::HashMap;
use std::ffi::CString;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::{AppState, WorkerRequest};
use tauri::Emitter;

#[derive(Debug, Clone, serde::Deserialize)]
pub struct TelemetryVariable {
    pub key: String,
    pub expression: String,
}

// ── Expression parsing ────────────────────────────────────────────────────────
//
// Supported read formats:
//   (A:NAME, Unit)  →  datum="NAME",    unit="Unit"
//   (E:NAME, Unit)  →  datum="NAME",    unit="Unit"  (environment variable)
//   (L:NAME)        →  datum="L:NAME",  unit="number"
//
// Supported write formats:
//   N (>L:NAME)     →  set L-var NAME to value N (f64)
//   N (>K:EVENT)    →  transmit key event EVENT with data N (u32)

struct ReadVar {
    datum: String,
    unit: String,
}

enum WriteOp {
    SetVar {
        datum: String,
        unit: String,
        value: f64,
    },
    KeyEvent {
        name: String,
        value: i32,
    },
}

fn parse_read(expr: &str) -> Option<ReadVar> {
    let inner = expr.trim().strip_prefix('(')?.strip_suffix(')')?;
    if let Some(name) = inner.strip_prefix("L:") {
        return Some(ReadVar {
            datum: format!("L:{name}"),
            unit: "number".into(),
        });
    }
    if let Some(rest) = inner.strip_prefix("A:") {
        let (name, unit) = rest.split_once(',')?;
        return Some(ReadVar {
            datum: name.trim().into(),
            unit: unit.trim().into(),
        });
    }
    if let Some(rest) = inner.strip_prefix("E:") {
        return if let Some((name, unit)) = rest.split_once(',') {
            Some(ReadVar {
                datum: name.trim().into(),
                unit: unit.trim().into(),
            })
        } else {
            Some(ReadVar {
                datum: rest.trim().into(),
                unit: "Number".into(),
            })
        };
    }
    None
}

fn parse_write(expr: &str) -> Option<WriteOp> {
    let expr = expr.trim();
    if let Some((val, rest)) = expr.split_once(" (>L:") {
        return Some(WriteOp::SetVar {
            datum: format!("L:{}", rest.strip_suffix(')')?),
            unit: "number".into(),
            value: val.trim().parse().ok()?,
        });
    }
    if let Some((val, rest)) = expr.split_once(" (>K:") {
        return Some(WriteOp::KeyEvent {
            name: rest.strip_suffix(')')?.into(),
            value: val.trim().parse::<i32>().ok()?,
        });
    }
    // K event with no value prefix: (>K:EVENT_NAME) → value defaults to 0
    if let Some(rest) = expr.strip_prefix("(>K:") {
        return Some(WriteOp::KeyEvent {
            name: rest.strip_suffix(')')?.into(),
            value: 0,
        });
    }
    None
}

// ── SimVars ───────────────────────────────────────────────────────────────────
struct SimVars {
    handle: sys::HANDLE,
    reads: HashMap<String, (u32, u32)>,
    write_defines: HashMap<String, u32>,
    events: HashMap<String, sys::DWORD>,
    define_seq: u32,
    request_seq: u32,
    event_seq: sys::DWORD,
    cache: Arc<Mutex<HashMap<u32, f64>>>,
}

impl SimVars {
    fn open(name: &str) -> Result<Self> {
        let cache: Arc<Mutex<HashMap<u32, f64>>> = Arc::new(Mutex::new(HashMap::new()));
        let mut handle = 0;
        let c_name = CString::new(name).unwrap();
        let hr = unsafe {
            sys::SimConnect_Open(&mut handle, c_name.as_ptr(), std::ptr::null_mut(), 0, 0, 0)
        };
        anyhow::ensure!(hr >= 0, "SimConnect_Open failed: HRESULT=0x{hr:08X}");
        unsafe {
            sys::SimConnect_CallDispatch(
                handle,
                Some(dispatch_cb),
                Arc::as_ptr(&cache) as *mut std::ffi::c_void,
            );
        }
        info!("[SimVars] Connected as \"{name}\"");
        Ok(Self {
            handle,
            reads: HashMap::new(),
            write_defines: HashMap::new(),
            events: HashMap::new(),
            define_seq: 1,
            request_seq: 0,
            event_seq: 0,
            cache,
        })
    }

    /// Register a variable for continuous polling. No-op if already registered.
    fn register_read(&mut self, datum: &str, unit: &str) -> Result<()> {
        if self.reads.contains_key(datum) {
            return Ok(());
        }
        let define_id = self.alloc_define();
        let request_id = self.alloc_request();
        let c_datum = CString::new(datum).unwrap();
        let c_unit = CString::new(unit).unwrap();
        unsafe {
            let hr = sys::SimConnect_AddToDataDefinition(
                self.handle,
                define_id,
                c_datum.as_ptr(),
                c_unit.as_ptr(),
                sys::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64,
                0.0,
                sys::SIMCONNECT_UNUSED,
            );
            anyhow::ensure!(hr >= 0, "AddToDataDefinition({datum}): HRESULT=0x{hr:08X}");
            let hr = sys::SimConnect_RequestDataOnSimObject(
                self.handle,
                request_id,
                define_id,
                sys::SIMCONNECT_OBJECT_ID_USER,
                sys::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_VISUAL_FRAME,
                sys::SIMCONNECT_DATA_REQUEST_FLAG_CHANGED,
                0,
                0,
                0,
            );
            anyhow::ensure!(
                hr >= 0,
                "RequestDataOnSimObject({datum}): HRESULT=0x{hr:08X}"
            );
        }
        self.reads
            .insert(datum.to_string(), (define_id, request_id));
        Ok(())
    }

    /// Returns the last received value for `datum`, or `None` if not yet received.
    fn get_cached(&self, datum: &str) -> Option<f64> {
        let (_, request_id) = self.reads.get(datum)?;
        self.cache.lock().ok()?.get(request_id).copied()
    }

    /// Write a float64 value to a sim variable or L-var.
    fn write_var(&mut self, datum: &str, unit: &str, value: f64) -> Result<()> {
        let define_id = self.define_id_for_write(datum, unit)?;
        unsafe {
            let hr = sys::SimConnect_SetDataOnSimObject(
                self.handle,
                define_id,
                sys::SIMCONNECT_OBJECT_ID_USER,
                0,
                0,
                std::mem::size_of::<f64>() as sys::DWORD,
                &value as *const f64 as *mut std::ffi::c_void,
            );
            anyhow::ensure!(hr >= 0, "SetDataOnSimObject({datum}): HRESULT=0x{hr:08X}");
        }
        Ok(())
    }

    /// Transmit a key event (input event) with an integer payload.
    fn trigger_key_event(&mut self, event_name: &str, value: i32) -> Result<()> {
        info!(
            "[SimVars] Trigger key event '{}' with data {}",
            event_name, value
        );
        let event_id = if let Some(&id) = self.events.get(event_name) {
            id
        } else {
            let id = self.alloc_event();
            let c_name = CString::new(event_name).unwrap();
            unsafe {
                let hr = sys::SimConnect_MapClientEventToSimEvent(self.handle, id, c_name.as_ptr());
                anyhow::ensure!(
                    hr >= 0,
                    "MapClientEventToSimEvent({event_name}): HRESULT=0x{hr:08X}"
                );
                // Keep the client event in a notification group so it can participate
                // in SimConnect's priority routing if needed.
                sys::SimConnect_AddClientEventToNotificationGroup(self.handle, 0, id, 0);
                sys::SimConnect_SetNotificationGroupPriority(
                    self.handle,
                    0,
                    sys::SIMCONNECT_GROUP_PRIORITY_HIGHEST_MASKABLE,
                );
            }
            self.events.insert(event_name.to_string(), id);
            id
        };
        unsafe {
            let hr = sys::SimConnect_TransmitClientEvent(
                self.handle,
                sys::SIMCONNECT_OBJECT_ID_USER,
                event_id,
                value as u32, // Bit-cast i32 to u32 for SimConnect
                sys::SIMCONNECT_GROUP_PRIORITY_HIGHEST,
                sys::SIMCONNECT_EVENT_FLAG_GROUPID_IS_PRIORITY,
            );
            anyhow::ensure!(
                hr >= 0,
                "TransmitClientEvent({event_name}): HRESULT=0x{hr:08X}"
            );
        }
        Ok(())
    }

    fn call_dispatch(&mut self) {
        unsafe {
            sys::SimConnect_CallDispatch(
                self.handle,
                Some(dispatch_cb),
                Arc::as_ptr(&self.cache) as *mut std::ffi::c_void,
            );
        }
    }

    fn alloc_define(&mut self) -> u32 {
        let id = self.define_seq;
        self.define_seq += 1;
        id
    }

    fn alloc_request(&mut self) -> u32 {
        let id = self.request_seq;
        self.request_seq += 1;
        id
    }

    fn alloc_event(&mut self) -> sys::DWORD {
        let id = self.event_seq;
        self.event_seq += 1;
        id
    }

    /// Returns the define_id to use for `SetDataOnSimObject`, reusing the read
    /// definition where possible to avoid redundant `AddToDataDefinition` calls.
    fn define_id_for_write(&mut self, datum: &str, unit: &str) -> Result<u32> {
        if let Some((define_id, _)) = self.reads.get(datum) {
            return Ok(*define_id);
        }
        if let Some(&define_id) = self.write_defines.get(datum) {
            return Ok(define_id);
        }
        let define_id = self.alloc_define();
        let c_datum = CString::new(datum).unwrap();
        let c_unit = CString::new(unit).unwrap();
        unsafe {
            let hr = sys::SimConnect_AddToDataDefinition(
                self.handle,
                define_id,
                c_datum.as_ptr(),
                c_unit.as_ptr(),
                sys::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64,
                0.0,
                sys::SIMCONNECT_UNUSED,
            );
            anyhow::ensure!(
                hr >= 0,
                "AddToDataDefinition write({datum}): HRESULT=0x{hr:08X}"
            );
        }
        self.write_defines.insert(datum.to_string(), define_id);
        Ok(define_id)
    }
}

impl Drop for SimVars {
    fn drop(&mut self) {
        unsafe { sys::SimConnect_Close(self.handle) };
    }
}

extern "C" fn dispatch_cb(
    recv: *mut sys::SIMCONNECT_RECV,
    _: sys::DWORD,
    context: *mut std::ffi::c_void,
) {
    unsafe {
        if (*recv).dwID as sys::SIMCONNECT_RECV_ID
            != sys::SIMCONNECT_RECV_ID_SIMCONNECT_RECV_ID_SIMOBJECT_DATA
        {
            return;
        }
        let data = &*(recv as *const sys::SIMCONNECT_RECV_SIMOBJECT_DATA);
        let value = *(std::ptr::addr_of!(data.dwData) as *const f64);
        let cache = &*(context as *const Mutex<HashMap<u32, f64>>);
        if let Ok(mut guard) = cache.lock() {
            guard.insert(data.dwRequestID, value);
        }
    }
}

// ── Worker thread ─────────────────────────────────────────────────────────────

struct StreamState {
    /// Pre-parsed (telemetry key, datum) pairs to avoid re-parsing on every tick.
    variables: Vec<(String, String)>,
    app_handle: tauri::AppHandle,
    interval_ms: u64,
}

pub fn spawn_simvar_worker() -> mpsc::Sender<WorkerRequest> {
    let (tx, rx) = mpsc::channel::<WorkerRequest>();
    thread::spawn(move || {
        let mut sim: Option<SimVars> = None;
        let mut stream: Option<StreamState> = None;
        loop {
            let timeout = stream
                .as_ref()
                .map(|s| Duration::from_millis(s.interval_ms))
                .unwrap_or(Duration::from_millis(5));
            match rx.recv_timeout(timeout) {
                Ok(req) => handle_request(req, &mut sim, &mut stream),
                Err(mpsc::RecvTimeoutError::Timeout) => on_tick(&mut sim, &stream),
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });
    tx
}

fn handle_request(req: WorkerRequest, sim: &mut Option<SimVars>, stream: &mut Option<StreamState>) {
    match req {
        WorkerRequest::Set {
            variable_string,
            respond_to,
        } => {
            let result = match sim.as_mut() {
                Some(c) => execute_write(c, &variable_string),
                None => Err("SimConnect not connected".into()),
            };
            let _ = respond_to.send(result);
        }

        WorkerRequest::Get {
            variable_string,
            respond_to,
        } => {
            let result = match sim.as_mut() {
                Some(c) => match parse_read(&variable_string) {
                    Some(ReadVar { datum, unit }) => {
                        let _ = c.register_read(&datum, &unit);
                        c.call_dispatch();
                        Ok(c.get_cached(&datum).map(|v| v as f32))
                    }
                    None => Err(format!("unrecognised read expression: {variable_string}")),
                },
                None => Err("SimConnect not connected".into()),
            };
            let _ = respond_to.send(result);
        }

        WorkerRequest::StartStream {
            variables,
            interval_ms,
            app_handle,
            respond_to,
        } => {
            // Always reopen — ensures fresh SimConnect handle and fresh data definitions
            // after sim reloads, aircraft changes, or app restarts.
            *sim = None;
            match SimVars::open("CrewMate") {
                Ok(c) => *sim = Some(c),
                Err(e) => {
                    let _ = respond_to.send(Err(e.to_string()));
                    return;
                }
            }
            let mut var_pairs = Vec::with_capacity(variables.len());
            if let Some(ref mut c) = sim {
                for var in &variables {
                    if let Some(ReadVar { datum, unit }) = parse_read(&var.expression) {
                        let _ = c.register_read(&datum, &unit);
                        var_pairs.push((var.key.clone(), datum));
                    }
                }
            }
            *stream = Some(StreamState {
                variables: var_pairs,
                app_handle,
                interval_ms,
            });
            let _ = respond_to.send(Ok(()));
        }

        WorkerRequest::StopStream(respond_to) => {
            *stream = None;
            let _ = respond_to.send(Ok(()));
        }
    }
}

fn execute_write(sim: &mut SimVars, expr: &str) -> Result<(), String> {
    match parse_write(expr) {
        Some(WriteOp::SetVar { datum, unit, value }) => sim
            .write_var(&datum, &unit, value)
            .map_err(|e| e.to_string()),
        Some(WriteOp::KeyEvent { name, value }) => sim
            .trigger_key_event(&name, value)
            .map_err(|e| e.to_string()),
        None => Err(format!("unrecognised write expression: {expr}")),
    }
}

fn on_tick(sim: &mut Option<SimVars>, stream: &Option<StreamState>) {
    let Some(ref mut c) = sim else { return };
    c.call_dispatch();
    let Some(ref s) = stream else { return };
    let values: HashMap<_, _> = s
        .variables
        .iter()
        .map(|(key, datum)| (key.clone(), c.get_cached(datum).unwrap_or(0.0)))
        .collect();
    let _ = s.app_handle.emit("telemetry_data", &values);
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn simvar_set(
    state: tauri::State<'_, AppState>,
    variable_string: String,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();
    state
        .inner()
        .tx
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .clone()
        .send(WorkerRequest::Set {
            variable_string,
            respond_to: tx,
        })
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn simvar_get(
    state: tauri::State<'_, AppState>,
    variable_string: String,
) -> Result<Option<f32>, String> {
    let (tx, rx) = mpsc::channel();
    state
        .inner()
        .tx
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .clone()
        .send(WorkerRequest::Get {
            variable_string,
            respond_to: tx,
        })
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn start_telemetry_stream(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    variables: Vec<TelemetryVariable>,
    interval_ms: u64,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();
    state
        .inner()
        .tx
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .clone()
        .send(WorkerRequest::StartStream {
            variables,
            interval_ms,
            app_handle,
            respond_to: tx,
        })
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn stop_telemetry_stream(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();
    state
        .inner()
        .tx
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .clone()
        .send(WorkerRequest::StopStream(tx))
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}
