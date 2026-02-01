mod audio;
mod commands;
mod ollama;
mod ollama_sidecar;
mod openai;
mod tray;
mod whisper;

use audio::create_audio_state;
use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register plugins
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        // Manage state
        .manage(create_audio_state())
        // Setup
        .setup(|app| {
            log::info!("Voice Enricher starting up...");

            // Create system tray
            #[cfg(desktop)]
            {
                if let Err(e) = tray::create_tray(app.handle()) {
                    log::error!("Failed to create system tray: {}", e);
                }
            }

            // Register global shortcut (Cmd/Ctrl+Shift+R)
            #[cfg(desktop)]
            {
                let shortcut = Shortcut::new(
                    Some(Modifiers::SUPER | Modifiers::SHIFT),
                    Code::KeyR,
                );

                let app_handle = app.handle().clone();

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcut(shortcut)?
                        .with_handler(move |_app, _shortcut, event| {
                            if event.state == ShortcutState::Pressed {
                                log::info!("Global shortcut triggered");
                                let _ = app_handle.emit("toggle-recording", ());
                            }
                        })
                        .build(),
                )?;

                log::info!("Global shortcut registered: Cmd/Ctrl+Shift+R");
            }

            // Check Ollama status (no longer starting sidecar - user must install Ollama)
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Check Ollama status
                let status = ollama_sidecar::check_ollama_status().await;
                log::info!("Ollama status: running={}, models={:?}", status.running, status.models);
                let _ = app_handle.emit("ollama-status", status);
            });

            Ok(())
        })
        // Handle window close events (minimize to tray)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide window instead of closing (minimize to tray)
                let _ = window.hide();
                api.prevent_close();
            }
        })
        // Register commands
        .invoke_handler(tauri::generate_handler![
            // Audio commands
            commands::audio::start_recording,
            commands::audio::stop_recording,
            commands::audio::is_recording,
            commands::audio::get_audio_level,
            // Transcription commands
            commands::transcription::transcribe,
            commands::transcription::get_available_whisper_models,
            commands::transcription::is_whisper_available,
            // Ollama commands
            commands::ollama::check_ollama_status,
            commands::ollama::discover_ollama,
            commands::ollama::get_ollama_models,
            commands::ollama::enrich_text,
            commands::ollama::ollama_generate,
            commands::ollama::get_enrichment_modes,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::reset_settings,
            // OpenAI commands
            commands::openai::check_openai_api_key,
            commands::openai::openai_transcribe,
            commands::openai::openai_enrich_text,
            commands::openai::openai_generate,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
