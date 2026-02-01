use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Default Ollama API base URL - use 127.0.0.1 as primary for Windows compatibility
/// Windows often has issues with 'localhost' resolution, especially with IPv6
#[cfg(target_os = "windows")]
pub const DEFAULT_OLLAMA_URL: &str = "http://127.0.0.1:11434";

#[cfg(not(target_os = "windows"))]
pub const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";

/// Fallback URLs to try if the default doesn't work (platform-specific order)
#[cfg(target_os = "windows")]
pub const FALLBACK_OLLAMA_URLS: &[&str] = &[
    "http://localhost:11434",
    "http://[::1]:11434",
    "http://host.docker.internal:11434",
    "http://0.0.0.0:11434",
];

#[cfg(not(target_os = "windows"))]
pub const FALLBACK_OLLAMA_URLS: &[&str] = &[
    "http://127.0.0.1:11434",
    "http://[::1]:11434",
    "http://host.docker.internal:11434",
];

/// Ollama generate request
#[derive(Debug, Clone, Serialize)]
pub struct GenerateRequest {
    pub model: String,
    pub prompt: String,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
}

/// Ollama generate response (non-streaming)
#[derive(Debug, Deserialize)]
pub struct GenerateResponse {
    pub model: String,
    pub response: String,
    pub done: bool,
    #[serde(default)]
    pub total_duration: Option<u64>,
    #[serde(default)]
    pub load_duration: Option<u64>,
    #[serde(default)]
    pub prompt_eval_count: Option<u32>,
    #[serde(default)]
    pub eval_count: Option<u32>,
}

/// Ollama streaming chunk
#[derive(Debug, Deserialize)]
pub struct StreamChunk {
    pub model: String,
    pub response: String,
    pub done: bool,
}

/// Ollama model info
#[derive(Debug, Deserialize, Serialize)]
pub struct ModelInfo {
    pub name: String,
    #[serde(default)]
    pub modified_at: String,
    #[serde(default)]
    pub size: u64,
}

/// List of available models
#[derive(Debug, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

/// Enrichment modes with their system prompts
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnrichmentMode {
    Email,
    TechnicalReport,
    MeetingProtocol,
    Bulletpoints,
    Custom,
}

impl EnrichmentMode {
    pub fn system_prompt(&self) -> Option<&'static str> {
        match self {
            EnrichmentMode::Email => Some(
                "Du bist ein professioneller E-Mail-Schreiber. Wandle die folgende Sprachtranskription in eine gut formatierte, professionelle E-Mail um. \
                Füge eine passende Anrede ein, organisiere den Inhalt in klare Absätze und ergänze eine professionelle Grußformel. \
                Behalte die ursprüngliche Absicht der Nachricht bei und verbessere dabei Klarheit und Professionalität. \
                Gib NUR die formatierte E-Mail aus, ohne Erklärungen oder Meta-Kommentare. Antworte auf Deutsch."
            ),
            EnrichmentMode::TechnicalReport => Some(
                "Du bist ein Spezialist für technische Dokumentation. Wandle die folgende Sprachtranskription in einen strukturierten technischen Bericht um. \
                Organisiere den Inhalt mit klaren Abschnitten: Zusammenfassung, Hintergrund (falls zutreffend), Hauptinhalt/Ergebnisse, \
                und Schlussfolgerungen/Empfehlungen (falls zutreffend). Verwende präzise technische Sprache und bleibe objektiv. \
                Gib NUR den formatierten Bericht aus, ohne Erklärungen. Antworte auf Deutsch."
            ),
            EnrichmentMode::MeetingProtocol => Some(
                "Du bist ein professioneller Protokollführer. Wandle die folgende Sprachtranskription in ein formelles Besprechungsprotokoll um. \
                Strukturiere die Ausgabe mit: Datum/Uhrzeit-Header, Teilnehmer (falls erwähnt), besprochene Tagesordnungspunkte, \
                getroffene Entscheidungen und Aktionspunkte (mit Verantwortlichen, falls erwähnt). Verwende klare, prägnante Sprache. \
                Gib NUR das formatierte Protokoll aus, ohne Erklärungen. Antworte auf Deutsch."
            ),
            EnrichmentMode::Bulletpoints => Some(
                "Du bist ein Inhalts-Zusammenfasser. Wandle die folgende Sprachtranskription in eine übersichtliche Stichpunkt-Zusammenfassung um. \
                Extrahiere die Kernpunkte, Hauptideen, Entscheidungen und Aktionspunkte. Verwende klare, kurze Aussagen für jeden Stichpunkt. \
                Gruppiere zusammengehörige Punkte unter Zwischenüberschriften, falls angemessen. \
                Gib NUR die Stichpunkte aus, ohne Erklärungen oder Einleitungen. Antworte auf Deutsch."
            ),
            EnrichmentMode::Custom => None, // User provides custom prompt
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            EnrichmentMode::Email => "E-Mail",
            EnrichmentMode::TechnicalReport => "Technischer Bericht",
            EnrichmentMode::MeetingProtocol => "Besprechungsprotokoll",
            EnrichmentMode::Bulletpoints => "Stichpunkte",
            EnrichmentMode::Custom => "Benutzerdefiniert",
        }
    }
}

/// Connection error details for better diagnostics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionError {
    pub message: String,
    pub urls_tried: Vec<String>,
    pub suggestion: String,
}

impl std::fmt::Display for ConnectionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

/// Ollama client with robust connection handling
pub struct OllamaClient {
    client: Client,
    base_url: String,
    /// The URL that was successfully connected (may differ from base_url after auto-discovery)
    working_url: Option<String>,
}

impl Default for OllamaClient {
    fn default() -> Self {
        Self::new(DEFAULT_OLLAMA_URL.to_string())
    }
}

impl OllamaClient {
    pub fn new(base_url: String) -> Self {
        // Create client with reasonable timeouts and Windows-specific settings
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(180))
            // Disable connection pooling for more reliable Windows connections
            .pool_max_idle_per_host(0)
            // Allow both IPv4 and IPv6
            .local_address(None)
            // Don't require HTTPS
            .danger_accept_invalid_certs(false)
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            base_url,
            working_url: None,
        }
    }

    /// Get the effective URL (working URL if discovered, otherwise base URL)
    fn effective_url(&self) -> &str {
        self.working_url.as_deref().unwrap_or(&self.base_url)
    }

    /// Check if Ollama is running at a specific URL
    async fn check_url(&self, url: &str) -> bool {
        let check_url = format!("{}/api/tags", url);

        log::debug!("Checking Ollama at: {}", check_url);

        match self.client
            .get(&check_url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(response) => {
                let success = response.status().is_success();
                log::debug!("Ollama check at {} returned status: {} (success: {})",
                    url, response.status(), success);
                success
            },
            Err(e) => {
                log::debug!("Ollama check at {} failed: {}", url, e);
                false
            }
        }
    }

    /// Check if Ollama is running, trying multiple URLs if needed
    pub async fn health_check(&self) -> Result<bool, String> {
        // First try the configured URL
        if self.check_url(&self.base_url).await {
            return Ok(true);
        }

        // Try fallback URLs
        for fallback_url in FALLBACK_OLLAMA_URLS {
            if self.check_url(fallback_url).await {
                log::info!("Ollama found at fallback URL: {}", fallback_url);
                return Ok(true);
            }
        }

        log::warn!("Ollama health check failed on all URLs");
        Ok(false)
    }

    /// Discover and connect to Ollama, trying multiple URLs
    pub async fn discover_and_connect(&mut self) -> Result<String, ConnectionError> {
        let mut urls_tried = vec![self.base_url.clone()];

        // First try the configured URL
        if self.check_url(&self.base_url).await {
            self.working_url = Some(self.base_url.clone());
            return Ok(self.base_url.clone());
        }

        // Try fallback URLs
        for fallback_url in FALLBACK_OLLAMA_URLS {
            urls_tried.push(fallback_url.to_string());
            if self.check_url(fallback_url).await {
                log::info!("Ollama discovered at: {}", fallback_url);
                self.working_url = Some(fallback_url.to_string());
                return Ok(fallback_url.to_string());
            }
        }

        Err(ConnectionError {
            message: "Ollama konnte nicht erreicht werden".to_string(),
            urls_tried,
            suggestion: self.get_platform_suggestion(),
        })
    }

    /// Get platform-specific suggestion for fixing Ollama connection
    fn get_platform_suggestion(&self) -> String {
        #[cfg(target_os = "windows")]
        {
            "Windows: \n\
             1. Stelle sicher, dass Ollama installiert ist (https://ollama.com/download/windows)\n\
             2. Starte Ollama über das Startmenü oder 'ollama serve' in der Kommandozeile\n\
             3. Prüfe, ob Ollama in der Taskleiste läuft (Lama-Icon)\n\
             4. Falls blockiert: Öffne Windows-Firewall und erlaube 'Ollama' für Port 11434\n\
             5. Teste mit: curl http://127.0.0.1:11434/api/tags"
                .to_string()
        }
        #[cfg(target_os = "macos")]
        {
            "macOS: Stelle sicher, dass Ollama installiert ist (https://ollama.com) \
             und die Ollama-App gestartet ist (sichtbar in der Menüleiste)."
                .to_string()
        }
        #[cfg(target_os = "linux")]
        {
            "Linux: Stelle sicher, dass der Ollama-Dienst läuft: 'systemctl status ollama' \
             oder starte ihn mit 'ollama serve'."
                .to_string()
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            "Stelle sicher, dass Ollama installiert ist und läuft (https://ollama.com).".to_string()
        }
    }

    /// Check if Ollama is running with detailed error info
    pub async fn health_check_detailed(&mut self) -> Result<HealthCheckResult, String> {
        match self.discover_and_connect().await {
            Ok(url) => Ok(HealthCheckResult {
                running: true,
                url,
                error: None,
            }),
            Err(conn_err) => Ok(HealthCheckResult {
                running: false,
                url: self.base_url.clone(),
                error: Some(conn_err),
            }),
        }
    }

    /// List available models with automatic URL discovery
    pub async fn list_models(&mut self) -> Result<Vec<ModelInfo>, String> {
        // Try to discover working URL if not already found
        if self.working_url.is_none() {
            let _ = self.discover_and_connect().await;
        }

        let url = format!("{}/api/tags", self.effective_url());

        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| self.format_connection_error(e))?;

        if !response.status().is_success() {
            return Err(format!("Ollama-Fehler: HTTP {}", response.status()));
        }

        let models_response: ModelsResponse = response
            .json()
            .await
            .map_err(|e| format!("Fehler beim Verarbeiten der Antwort: {}", e))?;

        Ok(models_response.models)
    }

    /// Format connection error with helpful message
    fn format_connection_error(&self, error: reqwest::Error) -> String {
        if error.is_connect() {
            format!(
                "Verbindung zu Ollama fehlgeschlagen ({}). {}",
                self.effective_url(),
                self.get_platform_suggestion()
            )
        } else if error.is_timeout() {
            format!(
                "Zeitüberschreitung bei Verbindung zu Ollama ({}). \
                 Ollama ist möglicherweise überlastet oder nicht gestartet.",
                self.effective_url()
            )
        } else {
            format!("Netzwerkfehler: {}", error)
        }
    }

    /// Generate text (non-streaming) with automatic URL discovery
    pub async fn generate(&mut self, request: &GenerateRequest) -> Result<String, String> {
        // Try to discover working URL if not already found
        if self.working_url.is_none() {
            self.discover_and_connect().await.map_err(|e| e.message)?;
        }

        let url = format!("{}/api/generate", self.effective_url());

        let response = self
            .client
            .post(&url)
            .json(request)
            .send()
            .await
            .map_err(|e| self.format_connection_error(e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Ollama-Fehler: {}", error_text));
        }

        let generate_response: GenerateResponse = response
            .json()
            .await
            .map_err(|e| format!("Fehler beim Verarbeiten der Antwort: {}", e))?;

        Ok(generate_response.response)
    }

    /// Generate text with streaming and automatic URL discovery
    pub async fn generate_streaming(
        &mut self,
        request: &GenerateRequest,
        app: &AppHandle,
    ) -> Result<String, String> {
        // Try to discover working URL if not already found
        if self.working_url.is_none() {
            self.discover_and_connect().await.map_err(|e| e.message)?;
        }

        let url = format!("{}/api/generate", self.effective_url());

        let mut streaming_request = request.clone();
        streaming_request.stream = true;

        let response = self
            .client
            .post(&url)
            .json(&streaming_request)
            .send()
            .await
            .map_err(|e| self.format_connection_error(e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Ollama-Fehler: {}", error_text));
        }

        let mut full_response = String::new();
        let mut stream = response.bytes_stream();

        use futures_util::StreamExt;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Stream-Fehler: {}", e))?;

            // Parse NDJSON (newline-delimited JSON)
            let text = String::from_utf8_lossy(&chunk);
            for line in text.lines() {
                if line.is_empty() {
                    continue;
                }

                if let Ok(stream_chunk) = serde_json::from_str::<StreamChunk>(line) {
                    full_response.push_str(&stream_chunk.response);

                    // Emit chunk to frontend
                    let _ = app.emit("ollama-stream", &stream_chunk.response);

                    if stream_chunk.done {
                        let _ = app.emit("ollama-done", ());
                        return Ok(full_response);
                    }
                }
            }
        }

        Ok(full_response)
    }

    /// Enrich text using specified mode
    pub async fn enrich_text(
        &mut self,
        text: &str,
        mode: EnrichmentMode,
        model: &str,
        custom_prompt: Option<&str>,
        app: &AppHandle,
    ) -> Result<String, String> {
        let system_prompt = match mode {
            EnrichmentMode::Custom => custom_prompt.map(|s| s.to_string()),
            _ => mode.system_prompt().map(|s| s.to_string()),
        };

        let prompt = format!(
            "Hier ist die Sprachtranskription zur Verarbeitung:\n\n{}\n\nBitte wandle diesen Text gemäß den Anweisungen um.",
            text
        );

        let request = GenerateRequest {
            model: model.to_string(),
            prompt,
            stream: true,
            system: system_prompt,
        };

        self.generate_streaming(&request, app).await
    }

    /// Get the currently working URL (if discovered)
    pub fn get_working_url(&self) -> Option<&str> {
        self.working_url.as_deref()
    }
}

/// Health check result with detailed information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub running: bool,
    pub url: String,
    pub error: Option<ConnectionError>,
}

/// Check if Ollama is running and has required model (with auto-discovery)
pub async fn check_ollama_setup(
    base_url: &str,
    required_model: &str,
) -> Result<OllamaSetupStatus, String> {
    let mut client = OllamaClient::new(base_url.to_string());

    // Try to discover and connect
    match client.discover_and_connect().await {
        Ok(working_url) => {
            // Check if required model is available
            match client.list_models().await {
                Ok(models) => {
                    let has_model = models
                        .iter()
                        .any(|m| m.name.starts_with(required_model) || m.name == required_model);

                    if has_model {
                        Ok(OllamaSetupStatus::Ready {
                            url: working_url,
                        })
                    } else {
                        Ok(OllamaSetupStatus::MissingModel {
                            model: required_model.to_string(),
                            url: working_url,
                            available_models: models.into_iter().map(|m| m.name).collect(),
                        })
                    }
                }
                Err(e) => Ok(OllamaSetupStatus::Error {
                    message: e,
                    url: working_url,
                }),
            }
        }
        Err(conn_err) => Ok(OllamaSetupStatus::NotRunning {
            urls_tried: conn_err.urls_tried,
            suggestion: conn_err.suggestion,
        }),
    }
}

/// Discover Ollama URL automatically
pub async fn discover_ollama_url() -> Option<String> {
    let mut client = OllamaClient::new(DEFAULT_OLLAMA_URL.to_string());
    client.discover_and_connect().await.ok()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum OllamaSetupStatus {
    Ready {
        url: String,
    },
    NotRunning {
        urls_tried: Vec<String>,
        suggestion: String,
    },
    MissingModel {
        model: String,
        url: String,
        available_models: Vec<String>,
    },
    Error {
        message: String,
        url: String,
    },
}
