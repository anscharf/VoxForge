use reqwest::{multipart, Client};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

/// OpenAI API base URL
pub const OPENAI_API_URL: &str = "https://api.openai.com/v1";

/// OpenAI chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// OpenAI chat completion request
#[derive(Debug, Clone, Serialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    pub stream: bool,
}

/// OpenAI chat completion response
#[derive(Debug, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub choices: Vec<ChatChoice>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
pub struct ChatChoice {
    pub index: u32,
    pub message: ChatMessage,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// OpenAI streaming chunk
#[derive(Debug, Deserialize)]
pub struct StreamChunk {
    pub id: String,
    pub choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
pub struct StreamChoice {
    pub index: u32,
    pub delta: Delta,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Delta {
    #[serde(default)]
    pub content: Option<String>,
}

/// OpenAI transcription response
#[derive(Debug, Deserialize)]
pub struct TranscriptionResponse {
    pub text: String,
}

/// OpenAI client
pub struct OpenAIClient {
    client: Client,
    api_key: String,
}

impl OpenAIClient {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    /// Check if the API key is valid by making a simple request
    pub async fn validate_api_key(&self) -> Result<bool, String> {
        let url = format!("{}/models", OPENAI_API_URL);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| format!("Failed to connect to OpenAI: {}", e))?;

        Ok(response.status().is_success())
    }

    /// Transcribe audio using OpenAI Whisper API
    pub async fn transcribe(
        &self,
        audio_path: PathBuf,
        model: &str,
        language: Option<&str>,
    ) -> Result<String, String> {
        let url = format!("{}/audio/transcriptions", OPENAI_API_URL);

        // Read the audio file
        let file_bytes = std::fs::read(&audio_path)
            .map_err(|e| format!("Failed to read audio file: {}", e))?;

        let file_name = audio_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("audio.wav")
            .to_string();

        // Create multipart form
        let mut form = multipart::Form::new()
            .part(
                "file",
                multipart::Part::bytes(file_bytes)
                    .file_name(file_name)
                    .mime_str("audio/wav")
                    .map_err(|e| format!("Failed to set mime type: {}", e))?,
            )
            .text("model", model.to_string());

        // Add language if specified
        if let Some(lang) = language {
            if lang != "auto" {
                form = form.text("language", lang.to_string());
            }
        }

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("Failed to send transcription request: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI transcription error: {}", error_text));
        }

        let transcription: TranscriptionResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse transcription response: {}", e))?;

        Ok(transcription.text)
    }

    /// Generate chat completion (non-streaming)
    pub async fn chat_completion(
        &self,
        request: &ChatCompletionRequest,
    ) -> Result<String, String> {
        let url = format!("{}/chat/completions", OPENAI_API_URL);

        let mut non_streaming_request = request.clone();
        non_streaming_request.stream = false;

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&non_streaming_request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI error: {}", error_text));
        }

        let completion: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        completion
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| "No response from OpenAI".to_string())
    }

    /// Generate chat completion with streaming
    pub async fn chat_completion_streaming(
        &self,
        request: &ChatCompletionRequest,
        app: &AppHandle,
    ) -> Result<String, String> {
        let url = format!("{}/chat/completions", OPENAI_API_URL);

        let mut streaming_request = request.clone();
        streaming_request.stream = true;

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&streaming_request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI error: {}", error_text));
        }

        let mut full_response = String::new();
        let mut stream = response.bytes_stream();

        use futures_util::StreamExt;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;

            let text = String::from_utf8_lossy(&chunk);

            // Parse SSE (Server-Sent Events) format
            for line in text.lines() {
                if line.starts_with("data: ") {
                    let data = &line[6..];

                    if data == "[DONE]" {
                        let _ = app.emit("ollama-done", ());
                        return Ok(full_response);
                    }

                    if let Ok(stream_chunk) = serde_json::from_str::<StreamChunk>(data) {
                        if let Some(choice) = stream_chunk.choices.first() {
                            if let Some(content) = &choice.delta.content {
                                full_response.push_str(content);
                                // Use the same event as Ollama for frontend compatibility
                                let _ = app.emit("ollama-stream", content);
                            }
                        }
                    }
                }
            }
        }

        let _ = app.emit("ollama-done", ());
        Ok(full_response)
    }

    /// Enrich text using specified mode
    pub async fn enrich_text(
        &self,
        text: &str,
        system_prompt: &str,
        model: &str,
        app: &AppHandle,
    ) -> Result<String, String> {
        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "Hier ist die Sprachtranskription zur Verarbeitung:\n\n{}\n\nBitte wandle diesen Text gemäß den Anweisungen um.",
                    text
                ),
            },
        ];

        let request = ChatCompletionRequest {
            model: model.to_string(),
            messages,
            temperature: Some(0.7),
            max_tokens: Some(4096),
            stream: true,
        };

        self.chat_completion_streaming(&request, app).await
    }
}

/// Check if OpenAI API key is valid
pub async fn check_openai_setup(api_key: &str) -> Result<OpenAISetupStatus, String> {
    if api_key.is_empty() {
        return Ok(OpenAISetupStatus::NoApiKey);
    }

    let client = OpenAIClient::new(api_key.to_string());

    match client.validate_api_key().await {
        Ok(true) => Ok(OpenAISetupStatus::Ready),
        Ok(false) => Ok(OpenAISetupStatus::InvalidApiKey),
        Err(e) => Ok(OpenAISetupStatus::Error(e)),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum OpenAISetupStatus {
    Ready,
    NoApiKey,
    InvalidApiKey,
    Error(String),
}
