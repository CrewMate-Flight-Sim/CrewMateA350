use crate::SpeechBridgeState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Helper function to create a modal window centered on the main window
fn create_modal_window(
    app_handle: &AppHandle,
    label: &str,
    url: &str,
    title: &str,
    width: f64,
    height: f64,
    resizable: bool,
) -> Result<(), String> {
    // Check if window already exists
    if let Some(window) = app_handle.get_webview_window(label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Get main window to set as parent and disable it
    let main_window = app_handle.get_webview_window("main");

    let mut builder = WebviewWindowBuilder::new(app_handle, label, WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(width, height)
        .maximizable(false)
        .resizable(resizable)
        .visible(false)
        .minimizable(false)
        .always_on_top(true);

    // Set parent window to make it modal and center on parent
    if let Some(parent) = &main_window {
        builder = builder.parent(parent).map_err(|e| e.to_string())?;

        // Calculate center position relative to main window
        if let Ok(main_pos) = parent.outer_position() {
            if let Ok(main_size) = parent.outer_size() {
                let x = main_pos.x + (main_size.width as i32 - width as i32) / 2;
                let y = main_pos.y + (main_size.height as i32 - height as i32) / 2;
                builder = builder.position(x as f64, y as f64);
            }
        }

        // Disable the main window
        parent.set_enabled(false).map_err(|e| e.to_string())?;
    }

    let window = builder.build().map_err(|e| e.to_string())?;

    // Re-enable main window when this window closes
    if let Some(main) = main_window {
        let main_clone = main.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::Destroyed = event {
                let _ = main_clone.set_enabled(true);
                let _ = main_clone.set_focus();
            }
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn set_always_on_top(app_handle: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window
            .set_always_on_top(always_on_top)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_takeoff_window(app_handle: AppHandle) -> Result<(), String> {
    create_modal_window(
        &app_handle,
        "takeoff",
        "src/windows/takeoff/takeoff.html",
        "Takeoff Plan",
        350.0,
        200.0,
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
        220.0,
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
        500.0,
        false,
    )
}

#[tauri::command]
pub async fn close_app(app_handle: tauri::AppHandle) {
    // Shutdown speech bridge before closing
    if let Some(speech_state) = app_handle.try_state::<SpeechBridgeState>() {
        speech_state.0.shutdown();
    }

    // Set the flag to allow closing without showing the dialog
    if let Some(should_close) = app_handle.try_state::<Arc<AtomicBool>>() {
        should_close.store(true, Ordering::SeqCst);
    }

    // It should close all windows
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.close();
    }
}
