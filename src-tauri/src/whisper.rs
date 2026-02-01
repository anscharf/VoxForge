use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

/// Whisper model sizes
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WhisperModel {
    Tiny,
    Base,
    Small,
    Medium,
    Large,
}

impl WhisperModel {
    pub fn filename(&self) -> &str {
        match self {
            WhisperModel::Tiny => "ggml-tiny.bin",
            WhisperModel::Base => "ggml-base.bin",
            WhisperModel::Small => "ggml-small.bin",
            WhisperModel::Medium => "ggml-medium.bin",
            WhisperModel::Large => "ggml-large.bin",
        }
    }
}

impl Default for WhisperModel {
    fn default() -> Self {
        WhisperModel::Base
    }
}

/// Supported languages
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    #[serde(rename = "en")]
    English,
    #[serde(rename = "de")]
    German,
    #[serde(rename = "auto")]
    Auto,
}

impl Language {
    pub fn code(&self) -> &str {
        match self {
            Language::English => "en",
            Language::German => "de",
            Language::Auto => "auto",
        }
    }
}

impl Default for Language {
    fn default() -> Self {
        Language::Auto
    }
}

/// Get platform-specific whisper binary name
fn get_whisper_binary_name() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    { "whisper-aarch64-apple-darwin" }

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    { "whisper-x86_64-apple-darwin" }

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    { "whisper-x86_64-pc-windows-msvc" }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    { "whisper-x86_64-unknown-linux-gnu" }

    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64")
    )))]
    { "whisper" }
}

/// Check if whisper binary exists and is accessible
pub fn check_whisper_binary(app: &AppHandle) -> Result<PathBuf, String> {
    let binary_name = get_whisper_binary_name();

    // Platform-specific binary name in bundle
    #[cfg(target_os = "windows")]
    let bundle_binary_name = "whisper.exe";
    #[cfg(not(target_os = "windows"))]
    let bundle_binary_name = "whisper";

    // On Windows, sidecars are placed next to the main executable
    #[cfg(target_os = "windows")]
    {
        // Get the executable path and check next to it
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let bundle_binary_path = exe_dir.join(bundle_binary_name);
                log::info!("Checking for whisper binary at (Windows exe dir): {:?}", bundle_binary_path);

                if bundle_binary_path.exists() {
                    return Ok(bundle_binary_path);
                }
            }
        }
    }

    // On macOS, sidecars are in the MacOS folder of the app bundle
    #[cfg(target_os = "macos")]
    {
        if let Ok(exe_dir) = app.path().resource_dir() {
            // Resources is at: /App.app/Contents/Resources
            // MacOS is at: /App.app/Contents/MacOS
            let macos_dir = exe_dir.parent().map(|p| p.join("MacOS"));

            if let Some(macos_path) = macos_dir {
                let bundle_binary_path = macos_path.join(bundle_binary_name);
                log::info!("Checking for whisper binary at (macOS bundle): {:?}", bundle_binary_path);

                if bundle_binary_path.exists() {
                    return Ok(bundle_binary_path);
                }
            }
        }
    }

    // Check in Resources/binaries (legacy path for both platforms)
    if let Ok(exe_dir) = app.path().resource_dir() {
        let legacy_path = exe_dir.join("binaries").join(binary_name);
        log::info!("Checking for whisper binary at (legacy): {:?}", legacy_path);

        if legacy_path.exists() {
            return Ok(legacy_path);
        }
    }

    // Check in development path
    let dev_binary_path = std::env::current_dir()
        .ok()
        .map(|p| p.join("src-tauri").join("binaries").join(binary_name));

    if let Some(dev_path) = dev_binary_path {
        log::info!("Checking for whisper binary at (dev): {:?}", dev_path);
        if dev_path.exists() {
            log::info!("Found whisper binary in development path: {:?}", dev_path);
            return Ok(dev_path);
        }
    }

    Err(format!(
        "Whisper-Binary nicht gefunden. \
         Bitte führe 'npm run setup:whisper' aus, um die erforderlichen Dateien herunterzuladen."
    ))
}

/// Get the path to the models directory
pub fn get_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // On Windows, resources are next to the executable
    #[cfg(target_os = "windows")]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // Check in resources/models next to exe
                let models_dir = exe_dir.join("resources").join("models");
                log::info!("Checking for models at (Windows exe dir): {:?}", models_dir);
                if models_dir.exists() {
                    return Ok(models_dir);
                }

                // Also check directly in models folder
                let alt_models_dir = exe_dir.join("models");
                log::info!("Checking for models at (Windows alt): {:?}", alt_models_dir);
                if alt_models_dir.exists() {
                    return Ok(alt_models_dir);
                }
            }
        }
    }

    // On macOS/Linux, use the resource_dir from Tauri
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let models_dir = resource_dir.join("resources").join("models");
    log::info!("Checking for models at (resource dir): {:?}", models_dir);

    if models_dir.exists() {
        return Ok(models_dir);
    }

    // Fallback: check in resource_dir directly
    let alt_models_dir = resource_dir.join("models");
    log::info!("Checking for models at (alt resource dir): {:?}", alt_models_dir);

    if alt_models_dir.exists() {
        return Ok(alt_models_dir);
    }

    // Return the expected path even if it doesn't exist yet
    Ok(resource_dir.join("resources").join("models"))
}

/// Get the path to a specific model file
pub fn get_model_path(app: &AppHandle, model: WhisperModel) -> Result<PathBuf, String> {
    let models_dir = get_models_dir(app)?;
    let model_path = models_dir.join(model.filename());

    if !model_path.exists() {
        return Err(format!(
            "Model file not found: {:?}. Please ensure the {} model is installed.",
            model_path,
            model.filename()
        ));
    }

    Ok(model_path)
}

/// Check if a model is available
pub fn is_model_available(app: &AppHandle, model: WhisperModel) -> bool {
    get_model_path(app, model).is_ok()
}

/// Transcribe audio using Whisper.cpp sidecar
pub async fn transcribe(
    app: &AppHandle,
    audio_path: PathBuf,
    model: WhisperModel,
    language: Language,
) -> Result<String, String> {
    log::info!("Starting transcription of {:?}", audio_path);

    // Validate audio file exists
    if !audio_path.exists() {
        return Err(format!("Audio-Datei nicht gefunden: {:?}", audio_path));
    }

    // Check if whisper binary exists first
    if let Err(e) = check_whisper_binary(app) {
        log::error!("Whisper binary check failed: {}", e);
        return Err(e);
    }

    // Get model path
    let model_path = get_model_path(app, model)?;

    log::info!("Using model: {:?}", model_path);
    log::info!("Language: {}", language.code());

    // Get the shell plugin
    let shell = app.shell();

    // Build arguments for whisper.cpp
    let mut args = vec![
        "-m".to_string(),
        model_path.to_string_lossy().to_string(),
        "-f".to_string(),
        audio_path.to_string_lossy().to_string(),
        "--output-txt".to_string(),
        "--no-timestamps".to_string(),
        "-pp".to_string(), // Print progress
    ];

    // Add language if not auto
    if !matches!(language, Language::Auto) {
        args.push("-l".to_string());
        args.push(language.code().to_string());
    }

    log::info!("Executing whisper with args: {:?}", args);

    // Execute whisper sidecar
    let output = shell
        .sidecar("whisper")
        .map_err(|e| {
            log::error!("Failed to create whisper sidecar: {}", e);
            format!(
                "Whisper-Sidecar konnte nicht erstellt werden: {}. \
                 Stelle sicher, dass die Whisper-Binary korrekt installiert ist. \
                 Führe 'npm run setup:whisper' aus.",
                e
            )
        })?
        .args(&args)
        .output()
        .await
        .map_err(|e| {
            log::error!("Failed to execute whisper: {}", e);
            format!(
                "Whisper konnte nicht ausgeführt werden: {}. \
                 Mögliche Ursachen: \
                 1) Die Binary fehlt oder ist nicht ausführbar \
                 2) Das Whisper-Modell ist nicht vorhanden \
                 3) Die Audio-Datei ist beschädigt",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        log::error!("Whisper failed with stderr: {}", stderr);
        log::error!("Whisper stdout: {}", stdout);

        let error_message = if stderr.contains("model") || stderr.contains("ggml") {
            format!(
                "Whisper-Modell konnte nicht geladen werden. \
                 Stelle sicher, dass das Modell '{}' existiert. \
                 Führe 'npm run setup:whisper' aus. \
                 Details: {}",
                model.filename(),
                stderr
            )
        } else if stderr.contains("audio") || stderr.contains("wav") || stderr.contains("format") {
            format!(
                "Audio-Datei konnte nicht verarbeitet werden. \
                 Möglicherweise ist das Format nicht unterstützt. \
                 Details: {}",
                stderr
            )
        } else {
            format!("Transkription fehlgeschlagen: {}", stderr)
        };

        return Err(error_message);
    }

    // Parse output - whisper.cpp outputs to stdout
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Clean up the transcription text
    let transcription = stdout
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with('['))
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    if transcription.is_empty() {
        log::warn!("Transcription resulted in empty text");
        return Err(
            "Die Transkription ergab keinen Text. \
             Mögliche Ursachen: \
             1) Die Aufnahme enthält keine erkennbare Sprache \
             2) Die Audioqualität ist zu niedrig \
             3) Das Mikrofon hat nicht funktioniert"
                .to_string(),
        );
    }

    log::info!("Transcription complete: {} characters", transcription.len());

    Ok(transcription)
}

/// Get available models
pub fn get_available_models(app: &AppHandle) -> Vec<WhisperModel> {
    let models = [
        WhisperModel::Tiny,
        WhisperModel::Base,
        WhisperModel::Small,
        WhisperModel::Medium,
        WhisperModel::Large,
    ];

    models
        .into_iter()
        .filter(|m| is_model_available(app, *m))
        .collect()
}
