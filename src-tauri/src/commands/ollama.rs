use crate::ollama::{
    check_ollama_setup, discover_ollama_url, EnrichmentMode, GenerateRequest,
    ModelInfo, OllamaClient, OllamaSetupStatus, DEFAULT_OLLAMA_URL,
};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

/// Request for text enrichment
#[derive(Debug, Deserialize)]
pub struct EnrichRequest {
    pub text: String,
    pub mode: EnrichmentMode,
    #[serde(default = "default_model")]
    pub model: String,
    pub custom_prompt: Option<String>,
    #[serde(default = "default_ollama_url")]
    pub ollama_url: String,
}

fn default_model() -> String {
    "llama3.2".to_string()
}

fn default_ollama_url() -> String {
    DEFAULT_OLLAMA_URL.to_string()
}

/// Response from enrichment
#[derive(Debug, Serialize)]
pub struct EnrichResponse {
    pub enriched_text: String,
    pub mode: EnrichmentMode,
    pub ollama_url: String,
}

/// Check Ollama status with automatic URL discovery
#[tauri::command]
pub async fn check_ollama_status(
    ollama_url: Option<String>,
    model: Option<String>,
) -> Result<OllamaSetupStatus, String> {
    let url = ollama_url.unwrap_or_else(|| DEFAULT_OLLAMA_URL.to_string());
    let required_model = model.unwrap_or_else(|| "llama3.2".to_string());

    check_ollama_setup(&url, &required_model).await
}

/// Discover the working Ollama URL
#[tauri::command]
pub async fn discover_ollama() -> Result<Option<String>, String> {
    Ok(discover_ollama_url().await)
}

/// Get available Ollama models with automatic URL discovery
#[tauri::command]
pub async fn get_ollama_models(ollama_url: Option<String>) -> Result<Vec<ModelInfo>, String> {
    // Try provided URL first, then discover
    let url = match ollama_url {
        Some(u) => u,
        None => discover_ollama_url()
            .await
            .ok_or_else(|| "Ollama konnte nicht gefunden werden. Bitte stelle sicher, dass Ollama installiert und gestartet ist.".to_string())?,
    };

    let mut client = OllamaClient::new(url);
    client.list_models().await
}

/// Enrich text using Ollama with streaming and automatic URL discovery
#[tauri::command]
pub async fn enrich_text(
    app: AppHandle,
    request: EnrichRequest,
) -> Result<EnrichResponse, String> {
    // Validate input
    if request.text.trim().is_empty() {
        return Err("Text darf nicht leer sein".to_string());
    }

    // Validate custom prompt for custom mode
    if request.mode == EnrichmentMode::Custom && request.custom_prompt.is_none() {
        return Err("Benutzerdefinierter Prompt ist erforderlich für den benutzerdefinierten Modus".to_string());
    }

    // Try to discover Ollama if the default URL doesn't work
    let mut client = OllamaClient::new(request.ollama_url.clone());

    // Attempt to connect and discover working URL
    let working_url = match client.discover_and_connect().await {
        Ok(url) => url,
        Err(conn_err) => {
            return Err(format!(
                "{}\n\n{}\n\nGetestete URLs: {}",
                conn_err.message,
                conn_err.suggestion,
                conn_err.urls_tried.join(", ")
            ));
        }
    };

    // Perform enrichment with streaming
    let enriched_text = client
        .enrich_text(
            &request.text,
            request.mode,
            &request.model,
            request.custom_prompt.as_deref(),
            &app,
        )
        .await?;

    Ok(EnrichResponse {
        enriched_text,
        mode: request.mode,
        ollama_url: working_url,
    })
}

/// Generate text without enrichment (raw prompt) with automatic URL discovery
#[tauri::command]
pub async fn ollama_generate(
    app: AppHandle,
    prompt: String,
    model: String,
    system: Option<String>,
    ollama_url: Option<String>,
    stream: Option<bool>,
) -> Result<OllamaGenerateResponse, String> {
    // Try provided URL or discover
    let base_url = ollama_url.unwrap_or_else(|| DEFAULT_OLLAMA_URL.to_string());
    let mut client = OllamaClient::new(base_url);

    // Attempt to connect and discover working URL
    let working_url = match client.discover_and_connect().await {
        Ok(url) => url,
        Err(conn_err) => {
            return Err(format!(
                "{}\n\n{}",
                conn_err.message,
                conn_err.suggestion
            ));
        }
    };

    let request = GenerateRequest {
        model,
        prompt,
        stream: stream.unwrap_or(true),
        system,
    };

    let response = if request.stream {
        client.generate_streaming(&request, &app).await?
    } else {
        client.generate(&request).await?
    };

    Ok(OllamaGenerateResponse {
        response,
        ollama_url: working_url,
    })
}

#[derive(Debug, Serialize)]
pub struct OllamaGenerateResponse {
    pub response: String,
    pub ollama_url: String,
}

/// Get available enrichment modes
#[tauri::command]
pub fn get_enrichment_modes() -> Vec<EnrichmentModeInfo> {
    vec![
        EnrichmentModeInfo {
            id: EnrichmentMode::Email,
            label: EnrichmentMode::Email.label().to_string(),
            description: "Als professionelle E-Mail mit Anrede, Inhalt und Grußformel formatieren".to_string(),
        },
        EnrichmentModeInfo {
            id: EnrichmentMode::TechnicalReport,
            label: EnrichmentMode::TechnicalReport.label().to_string(),
            description: "Als technischen Bericht mit Abschnitten strukturieren".to_string(),
        },
        EnrichmentModeInfo {
            id: EnrichmentMode::MeetingProtocol,
            label: EnrichmentMode::MeetingProtocol.label().to_string(),
            description: "Als Besprechungsprotokoll mit Aktionspunkten formatieren".to_string(),
        },
        EnrichmentModeInfo {
            id: EnrichmentMode::Bulletpoints,
            label: EnrichmentMode::Bulletpoints.label().to_string(),
            description: "Als übersichtliche Stichpunkte zusammenfassen".to_string(),
        },
        EnrichmentModeInfo {
            id: EnrichmentMode::Custom,
            label: EnrichmentMode::Custom.label().to_string(),
            description: "Eigenen Prompt verwenden".to_string(),
        },
    ]
}

#[derive(Debug, Serialize)]
pub struct EnrichmentModeInfo {
    pub id: EnrichmentMode,
    pub label: String,
    pub description: String,
}
