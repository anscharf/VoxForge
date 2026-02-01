use crate::audio::{SharedAudioState, start_recording_async, stop_recording_sync};
use tauri::{AppHandle, State};

/// Start audio recording
#[tauri::command]
pub fn start_recording(
    app: AppHandle,
    state: State<'_, SharedAudioState>,
) -> Result<(), String> {
    start_recording_async((*state).clone(), app)
}

/// Stop audio recording and return the path to the recorded file
#[tauri::command]
pub fn stop_recording(
    app: AppHandle,
    state: State<'_, SharedAudioState>,
) -> Result<String, String> {
    let path = stop_recording_sync(&state, &app)?;
    Ok(path.to_string_lossy().to_string())
}

/// Check if currently recording
#[tauri::command]
pub fn is_recording(state: State<'_, SharedAudioState>) -> bool {
    state.is_recording()
}

/// Get current audio level (for visualization)
#[tauri::command]
pub fn get_audio_level(state: State<'_, SharedAudioState>) -> f32 {
    state.get_audio_level()
}
