use crate::whisper::{self, Language, WhisperModel};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

/// Request for transcription
#[derive(Debug, Deserialize)]
pub struct TranscribeRequest {
    pub audio_path: String,
    #[serde(default)]
    pub model: WhisperModel,
    #[serde(default)]
    pub language: Language,
}

/// Response from transcription
#[derive(Debug, Serialize)]
pub struct TranscribeResponse {
    pub text: String,
    pub audio_path: String,
}

/// Transcribe audio file using Whisper
#[tauri::command]
pub async fn transcribe(
    app: AppHandle,
    request: TranscribeRequest,
) -> Result<TranscribeResponse, String> {
    let audio_path = PathBuf::from(&request.audio_path);

    // Validate the path
    if !audio_path.exists() {
        return Err(format!("Audio file not found: {}", request.audio_path));
    }

    // Validate file extension
    let extension = audio_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    if !["wav", "mp3", "ogg", "flac", "m4a"].contains(&extension.to_lowercase().as_str()) {
        return Err("Unsupported audio format. Please use WAV, MP3, OGG, FLAC, or M4A.".to_string());
    }

    // Perform transcription
    let text = whisper::transcribe(&app, audio_path, request.model, request.language).await?;

    Ok(TranscribeResponse {
        text,
        audio_path: request.audio_path,
    })
}

/// Get available Whisper models
#[tauri::command]
pub fn get_available_whisper_models(app: AppHandle) -> Vec<String> {
    whisper::get_available_models(&app)
        .into_iter()
        .map(|m| format!("{:?}", m).to_lowercase())
        .collect()
}

/// Check if Whisper is available (sidecar exists)
#[tauri::command]
pub fn is_whisper_available(app: AppHandle) -> Result<WhisperStatus, String> {
    let binary_available = whisper::check_whisper_binary(&app).is_ok();
    let models = whisper::get_available_models(&app);

    Ok(WhisperStatus {
        binary_available,
        models_available: !models.is_empty(),
        available_models: models
            .into_iter()
            .map(|m| format!("{:?}", m).to_lowercase())
            .collect(),
    })
}

/// Whisper availability status
#[derive(Debug, serde::Serialize)]
pub struct WhisperStatus {
    pub binary_available: bool,
    pub models_available: bool,
    pub available_models: Vec<String>,
}
