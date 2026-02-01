use std::time::Duration;
use crate::ollama::{DEFAULT_OLLAMA_URL, FALLBACK_OLLAMA_URLS};

/// Check if Ollama server is running by making a health check request
/// Tries multiple URLs for Windows/cross-platform compatibility
pub async fn is_ollama_running() -> bool {
    match find_ollama_url().await {
        Some(_) => true,
        None => false,
    }
}

/// Find a working Ollama URL by trying multiple addresses
pub async fn find_ollama_url() -> Option<String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(2))
        .timeout(Duration::from_secs(3))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    // Try default URL first
    if check_ollama_at_url(&client, DEFAULT_OLLAMA_URL).await {
        return Some(DEFAULT_OLLAMA_URL.to_string());
    }

    // Try fallback URLs
    for url in FALLBACK_OLLAMA_URLS {
        if check_ollama_at_url(&client, url).await {
            log::info!("Ollama found at fallback URL: {}", url);
            return Some(url.to_string());
        }
    }

    None
}

/// Check if Ollama is running at a specific URL
async fn check_ollama_at_url(client: &reqwest::Client, base_url: &str) -> bool {
    let url = format!("{}/api/tags", base_url);
    match client.get(&url).send().await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

/// Check Ollama status and return details
pub async fn check_ollama_status() -> OllamaStatus {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    // Try to find a working URL
    let working_url = match find_ollama_url().await {
        Some(url) => url,
        None => {
            return OllamaStatus {
                running: false,
                url: None,
                models: vec![],
                error: Some(get_platform_error_message()),
                urls_tried: get_all_urls(),
            };
        }
    };

    // Get available models
    let models_url = format!("{}/api/tags", working_url);
    let response = match client.get(&models_url).send().await {
        Ok(r) => r,
        Err(e) => {
            return OllamaStatus {
                running: false,
                url: Some(working_url),
                models: vec![],
                error: Some(format!("Verbindungsfehler: {}", e)),
                urls_tried: get_all_urls(),
            };
        }
    };

    if !response.status().is_success() {
        return OllamaStatus {
            running: true,
            url: Some(working_url),
            models: vec![],
            error: Some("Ollama antwortet nicht richtig".to_string()),
            urls_tried: vec![],
        };
    }

    #[derive(serde::Deserialize)]
    struct ModelsResponse {
        models: Vec<ModelInfo>,
    }

    #[derive(serde::Deserialize)]
    struct ModelInfo {
        name: String,
    }

    match response.json::<ModelsResponse>().await {
        Ok(models_response) => {
            let model_names: Vec<String> = models_response.models.iter().map(|m| m.name.clone()).collect();
            OllamaStatus {
                running: true,
                url: Some(working_url),
                models: model_names,
                error: None,
                urls_tried: vec![],
            }
        }
        Err(e) => OllamaStatus {
            running: true,
            url: Some(working_url),
            models: vec![],
            error: Some(format!("Fehler beim Laden der Modelle: {}", e)),
            urls_tried: vec![],
        },
    }
}

/// Get platform-specific error message
fn get_platform_error_message() -> String {
    #[cfg(target_os = "windows")]
    {
        "Ollama ist nicht erreichbar.\n\n\
         Bitte prüfe:\n\
         1. Ist Ollama installiert? (https://ollama.com/download/windows)\n\
         2. Läuft Ollama im Hintergrund? (Suche nach dem Ollama-Symbol in der Taskleiste)\n\
         3. Falls installiert, starte Ollama manuell\n\
         4. Prüfe die Windows-Firewall für Port 11434"
            .to_string()
    }
    #[cfg(target_os = "macos")]
    {
        "Ollama ist nicht gestartet.\n\n\
         Bitte prüfe:\n\
         1. Ist Ollama installiert? (https://ollama.com)\n\
         2. Ist die Ollama-App gestartet? (Suche nach dem Ollama-Symbol in der Menüleiste)"
            .to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "Ollama ist nicht gestartet.\n\n\
         Bitte prüfe:\n\
         1. Ist Ollama installiert?\n\
         2. Läuft der Dienst? ('systemctl status ollama')\n\
         3. Oder starte manuell mit 'ollama serve'"
            .to_string()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        "Ollama ist nicht gestartet. Bitte installiere und starte Ollama von https://ollama.com"
            .to_string()
    }
}

/// Get all URLs that are tried
fn get_all_urls() -> Vec<String> {
    let mut urls = vec![DEFAULT_OLLAMA_URL.to_string()];
    urls.extend(FALLBACK_OLLAMA_URLS.iter().map(|s| s.to_string()));
    urls
}

#[derive(serde::Serialize, Clone)]
pub struct OllamaStatus {
    pub running: bool,
    pub url: Option<String>,
    pub models: Vec<String>,
    pub error: Option<String>,
    pub urls_tried: Vec<String>,
}
