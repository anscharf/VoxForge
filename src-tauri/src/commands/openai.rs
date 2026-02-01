use crate::openai::{check_openai_setup, ChatCompletionRequest, ChatMessage, OpenAIClient, OpenAISetupStatus};
use crate::ollama::EnrichmentMode;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

/// Request for OpenAI transcription
#[derive(Debug, Deserialize)]
pub struct OpenAITranscribeRequest {
    pub audio_path: String,
    pub api_key: String,
    #[serde(default = "default_transcription_model")]
    pub model: String,
    pub language: Option<String>,
}

fn default_transcription_model() -> String {
    "whisper-1".to_string()
}

/// Request for OpenAI enrichment
#[derive(Debug, Deserialize)]
pub struct OpenAIEnrichRequest {
    pub text: String,
    pub api_key: String,
    pub mode: EnrichmentMode,
    #[serde(default = "default_chat_model")]
    pub model: String,
    pub custom_prompt: Option<String>,
}

fn default_chat_model() -> String {
    "gpt-4o-mini".to_string()
}

/// Response from enrichment
#[derive(Debug, Serialize)]
pub struct OpenAIEnrichResponse {
    pub enriched_text: String,
    pub mode: EnrichmentMode,
}

/// Check OpenAI API key validity
#[tauri::command]
pub async fn check_openai_api_key(api_key: String) -> Result<OpenAISetupStatus, String> {
    check_openai_setup(&api_key).await
}

/// Transcribe audio using OpenAI Whisper API
#[tauri::command]
pub async fn openai_transcribe(
    request: OpenAITranscribeRequest,
) -> Result<String, String> {
    let audio_path = PathBuf::from(&request.audio_path);

    // Validate the path
    if !audio_path.exists() {
        return Err(format!("Audio file not found: {}", request.audio_path));
    }

    let client = OpenAIClient::new(request.api_key);

    client
        .transcribe(
            audio_path,
            &request.model,
            request.language.as_deref(),
        )
        .await
}

/// Enrich text using OpenAI with streaming
#[tauri::command]
pub async fn openai_enrich_text(
    app: AppHandle,
    request: OpenAIEnrichRequest,
) -> Result<OpenAIEnrichResponse, String> {
    // Validate input
    if request.text.trim().is_empty() {
        return Err("Text to enrich cannot be empty".to_string());
    }

    // Validate custom prompt for custom mode
    if request.mode == EnrichmentMode::Custom && request.custom_prompt.is_none() {
        return Err("Custom prompt is required for custom enrichment mode".to_string());
    }

    // Get system prompt based on mode
    let system_prompt = match request.mode {
        EnrichmentMode::Custom => request.custom_prompt.unwrap_or_default(),
        _ => request.mode.system_prompt().unwrap_or("").to_string(),
    };

    let client = OpenAIClient::new(request.api_key);

    let enriched_text = client
        .enrich_text(&request.text, &system_prompt, &request.model, &app)
        .await?;

    Ok(OpenAIEnrichResponse {
        enriched_text,
        mode: request.mode,
    })
}

/// Generate chat completion with OpenAI
#[tauri::command]
pub async fn openai_generate(
    app: AppHandle,
    api_key: String,
    prompt: String,
    model: String,
    system: Option<String>,
    stream: Option<bool>,
) -> Result<String, String> {
    let client = OpenAIClient::new(api_key);

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
