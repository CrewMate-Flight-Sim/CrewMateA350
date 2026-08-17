// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Set up panic hook early so it catches panics from any thread,
    // including those before Tauri's event loop starts.
    let prev_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        if let Some(speech) = crewmatea350_lib::SPEECH_BRIDGE_STATE.get() {
            speech.shutdown();
        }
        prev_hook(panic_info);
    }));

    crewmatea350_lib::run()
}
