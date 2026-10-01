mod windows;

const CONFIG: crewmate_core::Config = crewmate_core::Config {
    app_name: "Crewmate INI A350",
    log_file_stem: "crewmateinia350",
    modal_windows: &["takeoff", "landing", "settings"],
    setup: None,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    crewmate_core::builder(CONFIG)
        .invoke_handler(crewmate_core::handler![
            windows::open_landing_window,
            windows::open_settings_window,
            windows::open_takeoff_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
