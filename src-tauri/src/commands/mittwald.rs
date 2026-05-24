use crate::ollama::EnrichmentMode;
use crate::openai::{
    check_mittwald_setup, ChatCompletionRequest, ChatMessage, OpenAIClient, OpenAISetupStatus,
    MITTWALD_API_URL,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

/// Request for Mittwald transcription
#[derive(Debug, Deserialize)]
pub struct MittwaldTranscribeRequest {
    pub audio_path: String,
    pub api_key: String,
    #[serde(default = "default_transcription_model")]
    pub model: String,
    pub language: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
}

fn default_transcription_model() -> String {
    "whisper-large-v3-turbo".to_string()
}

/// Request for Mittwald enrichment
#[derive(Debug, Deserialize)]
pub struct MittwaldEnrichRequest {
    pub text: String,
    pub api_key: String,
    pub mode: EnrichmentMode,
    #[serde(default = "default_chat_model")]
    pub model: String,
    pub custom_prompt: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
}

fn default_chat_model() -> String {
    "Mistral-Small-3.2-24B-Instruct".to_string()
}

/// Response from enrichment
#[derive(Debug, Serialize)]
pub struct MittwaldEnrichResponse {
    pub enriched_text: String,
    pub mode: EnrichmentMode,
}

fn resolve_base_url(custom: Option<String>) -> String {
    custom
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| MITTWALD_API_URL.to_string())
}

/// Check Mittwald API key validity
#[tauri::command]
pub async fn check_mittwald_api_key(api_key: String) -> Result<OpenAISetupStatus, String> {
    check_mittwald_setup(&api_key).await
}

/// Transcribe audio using Mittwald-hosted Whisper (whisper-large-v3-turbo)
#[tauri::command]
pub async fn mittwald_transcribe(
    request: MittwaldTranscribeRequest,
) -> Result<String, String> {
    let audio_path = PathBuf::from(&request.audio_path);

    if !audio_path.exists() {
        return Err(format!("Audio file not found: {}", request.audio_path));
    }

    let base_url = resolve_base_url(request.base_url);
    let client = OpenAIClient::new(request.api_key, base_url);

    client
        .transcribe(
            audio_path,
            &request.model,
            request.language.as_deref(),
        )
        .await
}

/// Enrich text using Mittwald-hosted LLM with streaming.
/// Emits the same `ollama-stream` / `ollama-done` events as the other providers,
/// so the frontend stays unchanged.
#[tauri::command]
pub async fn mittwald_enrich_text(
    app: AppHandle,
    request: MittwaldEnrichRequest,
) -> Result<MittwaldEnrichResponse, String> {
    if request.text.trim().is_empty() {
        return Err("Text to enrich cannot be empty".to_string());
    }

    if request.mode == EnrichmentMode::Custom && request.custom_prompt.is_none() {
        return Err("Custom prompt is required for custom enrichment mode".to_string());
    }

    let system_prompt = match request.mode {
        EnrichmentMode::Custom => request.custom_prompt.unwrap_or_default(),
        _ => request.mode.system_prompt().unwrap_or("").to_string(),
    };

    let base_url = resolve_base_url(request.base_url);
    let client = OpenAIClient::new(request.api_key, base_url);

    let enriched_text = client
        .enrich_text(&request.text, &system_prompt, &request.model, &app)
        .await?;

    Ok(MittwaldEnrichResponse {
        enriched_text,
        mode: request.mode,
    })
}

/// Raw chat completion against Mittwald.
#[tauri::command]
pub async fn mittwald_generate(
    app: AppHandle,
    api_key: String,
    prompt: String,
    model: String,
    system: Option<String>,
    base_url: Option<String>,
    stream: Option<bool>,
) -> Result<String, String> {
    let base_url = resolve_base_url(base_url);
    let client = OpenAIClient::new(api_key, base_url);

    let mut messages = Vec::new();

    if let Some(sys) = system {
        messages.push(ChatMessage {
            role: "system".to_string(),
            content: sys,
        });
    }

    messages.push(ChatMessage {
        role: "user".to_string(),
        content: prompt,
    });

    let request = ChatCompletionRequest {
        model,
        messages,
        temperature: Some(0.7),
        max_tokens: Some(4096),
        stream: stream.unwrap_or(true),
    };

    if request.stream {
        client.chat_completion_streaming(&request, &app).await
    } else {
        client.chat_completion(&request).await
    }
}
