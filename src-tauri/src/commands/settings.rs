use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_PATH: &str = "settings.json";

/// AI Provider for text enrichment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AIProvider {
    Ollama,
    Openai,
    Mittwald,
}

impl Default for AIProvider {
    fn default() -> Self {
        AIProvider::Ollama
    }
}

/// Transcription Provider
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TranscriptionProvider {
    Whisper,
    Openai,
    Mittwald,
}

impl Default for TranscriptionProvider {
    fn default() -> Self {
        TranscriptionProvider::Whisper
    }
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Global hotkey for recording
    pub hotkey: String,

    /// Whisper model size
    pub whisper_model: String,

    /// Transcription language
    pub language: String,

    /// Ollama model name
    pub ollama_model: String,

    /// Ollama API URL
    pub ollama_url: String,

    /// Start minimized to tray
    pub start_minimized: bool,

    /// Minimize to tray on close
    pub minimize_to_tray: bool,

    /// Default enrichment mode
    pub default_enrichment_mode: String,

    /// Default export directory
    pub export_directory: Option<String>,

    /// AI Provider for text enrichment (ollama or openai)
    #[serde(default)]
    pub ai_provider: AIProvider,

    /// Transcription provider (whisper or openai)
    #[serde(default)]
    pub transcription_provider: TranscriptionProvider,

    /// OpenAI API Key
    #[serde(default)]
    pub openai_api_key: String,

    /// OpenAI model for enrichment (e.g., gpt-4o, gpt-4o-mini)
    #[serde(default = "default_openai_model")]
    pub openai_model: String,

    /// OpenAI model for transcription (e.g., whisper-1)
    #[serde(default = "default_openai_transcription_model")]
    pub openai_transcription_model: String,

    /// Mittwald AI Hosting API Key
    #[serde(default)]
    pub mittwald_api_key: String,

    /// Mittwald base URL (override; default: https://llm.aihosting.mittwald.de/v1)
    #[serde(default = "default_mittwald_base_url")]
    pub mittwald_base_url: String,

    /// Mittwald LLM model for enrichment
    #[serde(default = "default_mittwald_model")]
    pub mittwald_model: String,

    /// Mittwald STT model for transcription
    #[serde(default = "default_mittwald_transcription_model")]
    pub mittwald_transcription_model: String,
}

fn default_openai_model() -> String {
    "gpt-4o-mini".to_string()
}

fn default_openai_transcription_model() -> String {
    "whisper-1".to_string()
}

fn default_mittwald_base_url() -> String {
    "https://llm.aihosting.mittwald.de/v1".to_string()
}

fn default_mittwald_model() -> String {
    "Mistral-Small-3.2-24B-Instruct".to_string()
}

fn default_mittwald_transcription_model() -> String {
    "whisper-large-v3-turbo".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            hotkey: "CommandOrControl+Shift+R".to_string(),
            whisper_model: "base".to_string(),
            language: "de".to_string(),
            ollama_model: "llama3.2".to_string(),
            ollama_url: "http://localhost:11434".to_string(),
            start_minimized: false,
            minimize_to_tray: true,
            default_enrichment_mode: "bulletpoints".to_string(),
            export_directory: None,
            ai_provider: AIProvider::default(),
            transcription_provider: TranscriptionProvider::default(),
            openai_api_key: String::new(),
            openai_model: default_openai_model(),
            openai_transcription_model: default_openai_transcription_model(),
            mittwald_api_key: String::new(),
            mittwald_base_url: default_mittwald_base_url(),
            mittwald_model: default_mittwald_model(),
            mittwald_transcription_model: default_mittwald_transcription_model(),
        }
    }
}

/// Get all settings
#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    // Try to load settings or return defaults
    let settings = match store.get("settings") {
        Some(value) => serde_json::from_value(value.clone())
            .unwrap_or_default(),
        None => AppSettings::default(),
    };

    Ok(settings)
}

/// Save all settings
#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    let value = serde_json::to_value(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    store.set("settings", value);
    store.save().map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

/// Get a specific setting
#[tauri::command]
pub async fn get_setting(app: AppHandle, key: String) -> Result<serde_json::Value, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    store
        .get(&key)
        .map(|v| v.clone())
        .ok_or_else(|| format!("Setting '{}' not found", key))
}

/// Set a specific setting
#[tauri::command]
pub async fn set_setting(
    app: AppHandle,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    store.set(&key, value);
    store.save().map_err(|e| format!("Failed to save setting: {}", e))?;

    Ok(())
}

/// Reset settings to defaults
#[tauri::command]
pub async fn reset_settings(app: AppHandle) -> Result<AppSettings, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    let defaults = AppSettings::default();
    let value = serde_json::to_value(&defaults)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    store.set("settings", value);
    store.save().map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(defaults)
}
