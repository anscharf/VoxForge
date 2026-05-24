// Enrichment modes matching Rust backend
export type EnrichmentMode =
  | "email"
  | "technical_report"
  | "meeting_protocol"
  | "bulletpoints"
  | "custom";

export interface EnrichmentModeInfo {
  id: EnrichmentMode;
  label: string;
  description: string;
}

// Ollama status (matches Rust OllamaSetupStatus enum)
export type OllamaSetupStatus =
  | { status: "ready"; url: string }
  | { status: "not_running"; urls_tried: string[]; suggestion: string }
  | { status: "missing_model"; model: string; url: string; available_models: string[] }
  | { status: "error"; message: string; url: string };

// Model info
export interface ModelInfo {
  name: string;
  modified_at: string;
  size: number;
}

// Transcription request/response
export interface TranscribeRequest {
  audio_path: string;
  model?: "tiny" | "base" | "small" | "medium" | "large";
  language?: "en" | "de" | "auto";
}

export interface TranscribeResponse {
  text: string;
  audio_path: string;
}

// Enrichment request/response
export interface EnrichRequest {
  text: string;
  mode: EnrichmentMode;
  model?: string;
  custom_prompt?: string;
  ollama_url?: string;
}

export interface EnrichResponse {
  enriched_text: string;
  mode: EnrichmentMode;
}

// AI Provider type
export type AIProvider = "ollama" | "openai" | "mittwald";

// Transcription provider type
export type TranscriptionProvider = "whisper" | "openai" | "mittwald";

// App settings
export interface AppSettings {
  hotkey: string;
  whisperModel: string;
  language: string;
  ollamaModel: string;
  ollamaUrl: string;
  startMinimized: boolean;
  minimizeToTray: boolean;
  defaultEnrichmentMode: string;
  exportDirectory: string | null;
  // AI Provider settings
  aiProvider: AIProvider;
  transcriptionProvider: TranscriptionProvider;
  openaiApiKey: string;
  openaiModel: string;
  openaiTranscriptionModel: string;
  // Mittwald AI Hosting settings (DSGVO-konform)
  mittwaldApiKey: string;
  mittwaldBaseUrl: string;
  mittwaldModel: string;
  mittwaldTranscriptionModel: string;
}

// Recording state
export type RecordingState = "idle" | "recording" | "processing" | "transcribing" | "enriching";

// Export format
export type ExportFormat = "pdf" | "docx" | "clipboard";
