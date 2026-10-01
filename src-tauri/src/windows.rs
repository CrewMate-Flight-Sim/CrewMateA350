use crewmate_core::create_modal_window;
use tauri::AppHandle;

#[tauri::command]
pub async fn open_takeoff_window(app_handle: AppHandle) -> Result<(), String> {
    create_modal_window(
        &app_handle,
        "takeoff",
        "src/windows/takeoff/takeoff.html",
        "Takeoff Plan",
        350.0,
        255.0,
        false,
    )
}

#[tauri::command]
pub async fn open_landing_window(app_handle: AppHandle) -> Result<(), String> {
    create_modal_window(
        &app_handle,
        "landing",
        "src/windows/landing/landing.html",
        "Landing Plan",
        350.0,
        250.0,
        false,
    )
}

#[tauri::command]
pub async fn open_settings_window(app_handle: AppHandle) -> Result<(), String> {
    create_modal_window(
        &app_handle,
        "settings",
        "src/windows/settings/settings.html",
        "Settings",
        385.0,
        640.0,
        false,
    )
}
