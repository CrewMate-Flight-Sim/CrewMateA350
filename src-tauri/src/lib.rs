use std::sync::{mpsc, Arc, Mutex};
mod audio;
use audio::audio_commands::{
    get_sound_packs, is_audio_playing, play_sound, play_sound_sequence, AudioPlayerState,
};
use audio::audio_devices::{
    get_available_input_devices, get_available_output_devices, set_input_device, set_output_device,
};
use audio::audio_player::AudioPlayer;
use brigdes::speech_bridge::get_speech_input_devices;
use tauri_plugin_window_state::StateFlags;

mod brigdes;
use brigdes::speech_bridge::SpeechBridge;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;
use tauri::Manager;

use simconnect::simvars::{
    simvar_get, simvar_set, spawn_simvar_worker, start_telemetry_stream, stop_telemetry_stream,
    TelemetryVariable,
};

mod app_data;
use app_data::{
    get_log_file_path, open_app_data_folder, open_logs_folder, setup_app_data_directories,
};

mod simconnect;
use simconnect::aircraft_title::{get_aircraft_title, start_aircraft_title_stream};
use simconnect::flight_state::{is_in_cockpit, start_flight_state_stream};

#[tauri::command]
fn get_in_cockpit() -> bool {
    is_in_cockpit()
}

#[tauri::command]
fn get_speech_engine_error(state: tauri::State<'_, SpeechBridgeState>) -> Option<String> {
    state.0.last_error()
}

#[tauri::command]
fn set_confidence_threshold(state: tauri::State<'_, SpeechBridgeState>, threshold: f32) {
    let safe_threshold = if threshold.is_finite() {
        threshold.clamp(0.0, 1.0)
    } else {
        log::warn!(
            "Received non-finite confidence threshold: {:?}, using default 0.85",
            threshold
        );
        0.85
    };
    let json = format!(r#"{{"confidenceThreshold":{:.3}}}"#, safe_threshold);
    state.0.send_config(&json);
}

#[tauri::command]
fn set_muted(state: tauri::State<'_, SpeechBridgeState>, muted: bool) {
    let json = format!(r#"{{"muted":{}}}"#, muted);
    state.0.send_config(&json);
}

mod windows;
use windows::{
    close_app, open_landing_window, open_settings_window, open_takeoff_window, set_always_on_top,
};

struct AppState {
    tx: Mutex<mpsc::Sender<WorkerRequest>>,
}

pub struct SpeechBridgeState(pub Arc<SpeechBridge>);

enum WorkerRequest {
    Set {
        variable_string: String,
        respond_to: mpsc::Sender<Result<(), String>>,
    },
    Get {
        variable_string: String,
        respond_to: mpsc::Sender<Result<Option<f32>, String>>,
    },
    StartStream {
        variables: Vec<TelemetryVariable>,
        interval_ms: u64,
        app_handle: tauri::AppHandle,
        respond_to: mpsc::Sender<Result<(), String>>,
    },
    StopStream(mpsc::Sender<Result<(), String>>),
}

use std::sync::OnceLock;

static SPEECH_BRIDGE_STATE: OnceLock<Arc<SpeechBridge>> = OnceLock::new();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let worker_tx = spawn_simvar_worker();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .with_denylist(&["takeoff", "landing", "settings"])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_prevent_default::debug())
        .setup(|app| {
            // Set up panic hook to ensure copilot_speech.exe is killed on crash
            let prev_hook = std::panic::take_hook();
            std::panic::set_hook(Box::new(move |panic_info| {
                // Kill the sidecar process before unwinding
                if let Some(speech) = SPEECH_BRIDGE_STATE.get() {
                    speech.shutdown();
                }
                prev_hook(panic_info);
            }));

            // Initialize speech recognition sidecar
            let speech = Arc::new(SpeechBridge::new(app.handle().clone()));
            SPEECH_BRIDGE_STATE.set(speech.clone()).ok();
            app.manage(SpeechBridgeState(speech.clone()));

            // Initialize audio player
            let audio_player = AudioPlayer::new().expect("Failed to initialize audio player");
            app.manage(AudioPlayerState(std::sync::Mutex::new(audio_player)));

            // Initialize SimVar worker
            app.manage(AppState {
                tx: Mutex::new(worker_tx),
            });

            // Start aircraft title SimConnect stream
            start_aircraft_title_stream(app.handle().clone());
            start_flight_state_stream(app.handle().clone());

            // Initialize logging
            let logs_dir = match app.path().app_data_dir() {
                Ok(app_data_dir) => {
                    let logs_path = app_data_dir.join("logs");
                    if let Err(e) = std::fs::create_dir_all(&logs_path) {
                        eprintln!("Failed to create logs directory: {}", e);
                        app_data_dir
                    } else {
                        logs_path
                    }
                }
                Err(e) => {
                    eprintln!("Failed to get app data directory: {}", e);
                    std::path::PathBuf::from(".")
                }
            };

            let log_plugin = tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Folder {
                        path: logs_dir,
                        file_name: Some("crewmateinia310".to_string()),
                    },
                ))
                .level(log::LevelFilter::Info)
                .build();

            app.handle()
                .plugin(log_plugin)
                .expect("Failed to initialize logging plugin");

            log::info!("Crewmate INI A310 application loaded...");

            if let Err(e) = setup_app_data_directories(app.handle()) {
                log::error!("Failed to setup app data directories: {}", e);
            }

            // Close request handling
            let should_close = Arc::new(AtomicBool::new(false));
            app.manage(should_close.clone());

            if let Some(window) = app.get_webview_window("main") {
                let window_for_closure = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if should_close.load(Ordering::SeqCst) {
                            return;
                        }
                        api.prevent_close();
                        let _ = window_for_closure.emit("close-requested", ());
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            close_app,
            open_landing_window,
            open_settings_window,
            open_takeoff_window,
            set_always_on_top,
            get_log_file_path,
            open_app_data_folder,
            open_logs_folder,
            simvar_set,
            simvar_get,
            start_telemetry_stream,
            stop_telemetry_stream,
            play_sound,
            play_sound_sequence,
            is_audio_playing,
            get_sound_packs,
            get_available_input_devices,
            get_available_output_devices,
            set_output_device,
            set_input_device,
            get_aircraft_title,
            get_in_cockpit,
            get_speech_engine_error,
            set_confidence_threshold,
            get_speech_input_devices,
            set_muted
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
