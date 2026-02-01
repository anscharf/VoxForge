"use client";

import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "@/stores/appStore";
import toast from "react-hot-toast";
import type {
  TranscribeRequest,
  TranscribeResponse,
  EnrichRequest,
  EnrichResponse,
  OllamaSetupStatus,
  AppSettings,
  EnrichmentModeInfo,
  ModelInfo,
} from "@/types";

// Hook for recording functionality
// Note: Event listeners (audio-level, recording-started, recording-stopped)
// are handled globally by TauriEventProvider to prevent duplicate registrations
export function useRecording() {
  const {
    recordingState,
    setRecordingState,
    setAudioPath,
  } = useAppStore();

  const startRecording = useCallback(async () => {
    try {
      await invoke("start_recording");
      setRecordingState("recording");
    } catch (error) {
      console.error("Failed to start recording:", error);
      setRecordingState("idle");
      throw error;
    }
  }, [setRecordingState]);

  const stopRecording = useCallback(async (): Promise<string> => {
    try {
      setRecordingState("processing");
      const audioPath = await invoke<string>("stop_recording");
      setAudioPath(audioPath);
      return audioPath;
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setRecordingState("idle");
      throw error;
    }
  }, [setRecordingState, setAudioPath]);

  const toggleRecording = useCallback(async () => {
    if (recordingState === "recording") {
      await stopRecording();
    } else if (recordingState === "idle") {
      await startRecording();
    }
  }, [recordingState, startRecording, stopRecording]);

  return {
    startRecording,
    stopRecording,
    toggleRecording,
    isRecording: recordingState === "recording",
  };
}

// Hook for transcription (supports both Whisper and OpenAI)
export function useTranscription() {
  const {
    setTranscription,
    setIsTranscribing,
    setRecordingState,
    settings,
  } = useAppStore();

  const transcribe = useCallback(
    async (audioPath: string): Promise<string> => {
      console.log("[useTranscription] transcribe called with audioPath:", audioPath);
      console.log("[useTranscription] current settings:", settings);
      toast.loading("Transkription wird gestartet...", { id: "transcribe" });
      try {
        setIsTranscribing(true);
        setRecordingState("transcribing");
        console.log("[useTranscription] State set to transcribing");

        let transcriptionText: string;

        // Check if we should use OpenAI for transcription
        if (settings?.transcriptionProvider === "openai" && settings?.openaiApiKey) {
          // Use OpenAI Whisper API
          console.log("[useTranscription] Using OpenAI for transcription");
          toast.loading("Verwende OpenAI Whisper...", { id: "transcribe" });
          transcriptionText = await invoke<string>("openai_transcribe", {
            request: {
              audio_path: audioPath,
              api_key: settings.openaiApiKey,
              model: settings.openaiTranscriptionModel || "whisper-1",
              language: settings.language !== "auto" ? settings.language : null,
            },
          });
        } else {
          // Use local Whisper
          console.log("[useTranscription] Using local Whisper for transcription");
          toast.loading("Verwende lokales Whisper...", { id: "transcribe" });
          const request: TranscribeRequest = {
            audio_path: audioPath,
            model: (settings?.whisperModel as TranscribeRequest["model"]) || "base",
            language: (settings?.language as TranscribeRequest["language"]) || "auto",
          };
          console.log("[useTranscription] Whisper request:", request);

          const response = await invoke<TranscribeResponse>("transcribe", {
            request,
          });
          console.log("[useTranscription] Whisper response:", response);
          transcriptionText = response.text;
        }

        console.log("[useTranscription] Transcription result:", transcriptionText?.substring(0, 100));
        setTranscription(transcriptionText);
        setRecordingState("idle");
        toast.success("Transkription abgeschlossen!", { id: "transcribe" });
        return transcriptionText;
      } catch (error) {
        console.error("[useTranscription] Transcription failed:", error);
        toast.error(`Transkription fehlgeschlagen: ${error}`, { id: "transcribe" });
        setRecordingState("idle");
        throw error;
      } finally {
        setIsTranscribing(false);
      }
    },
    [settings, setTranscription, setIsTranscribing, setRecordingState]
  );

  return { transcribe };
}

// Hook for text enrichment (supports both Ollama and OpenAI)
// Note: Event listeners (ollama-stream, ollama-done) are handled globally
// by TauriEventProvider to prevent duplicate registrations
export function useEnrichment() {
  const {
    setEnrichedText,
    setIsEnriching,
    setRecordingState,
    enrichmentMode,
    customPrompt,
    settings,
  } = useAppStore();

  const enrich = useCallback(
    async (text: string): Promise<string> => {
      try {
        setIsEnriching(true);
        setRecordingState("enriching");
        setEnrichedText(""); // Clear previous

        // Check if we should use OpenAI for enrichment
        if (settings?.aiProvider === "openai" && settings?.openaiApiKey) {
          // Use OpenAI - streaming populates text via events
          await invoke<{ enriched_text: string; mode: string }>(
            "openai_enrich_text",
            {
              request: {
                text,
                api_key: settings.openaiApiKey,
                mode: enrichmentMode,
                model: settings.openaiModel || "gpt-4o-mini",
                custom_prompt: enrichmentMode === "custom" ? customPrompt : undefined,
              },
            }
          );
        } else {
          // Use Ollama - streaming populates text via events
          const request: EnrichRequest = {
            text,
            mode: enrichmentMode,
            model: settings?.ollamaModel || "llama3.2",
            custom_prompt: enrichmentMode === "custom" ? customPrompt : undefined,
            ollama_url: settings?.ollamaUrl || "http://localhost:11434",
          };

          await invoke<EnrichResponse>("enrich_text", {
            request,
          });
        }

        // Return empty - the actual text is populated via streaming events
        return "";
      } catch (error) {
        console.error("Enrichment failed:", error);
        setRecordingState("idle");
        throw error;
      } finally {
        setIsEnriching(false);
      }
    },
    [
      enrichmentMode,
      customPrompt,
      settings,
      setEnrichedText,
      setIsEnriching,
      setRecordingState,
    ]
  );

  return { enrich };
}

// Hook for Ollama status
export function useOllamaStatus() {
  const { ollamaStatus, setOllamaStatus } = useAppStore();
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    const setupListener = async () => {
      unlistenRef.current = await listen<OllamaSetupStatus>(
        "ollama-status",
        (event) => {
          setOllamaStatus(event.payload);
        }
      );
    };

    setupListener();

    return () => {
      unlistenRef.current?.();
    };
  }, [setOllamaStatus]);

  const checkStatus = useCallback(async () => {
    try {
      const status = await invoke<OllamaSetupStatus>("check_ollama_status", {
        ollamaUrl: null,
        model: null,
      });
      setOllamaStatus(status);
      return status;
    } catch (error) {
      console.error("Failed to check Ollama status:", error);
      throw error;
    }
  }, [setOllamaStatus]);

  const getModels = useCallback(async (): Promise<ModelInfo[]> => {
    try {
      return await invoke<ModelInfo[]>("get_ollama_models", {
        ollamaUrl: null,
      });
    } catch (error) {
      console.error("Failed to get Ollama models:", error);
      throw error;
    }
  }, []);

  return { ollamaStatus, checkStatus, getModels };
}

// Hook for settings
export function useSettings() {
  const { settings, setSettings } = useAppStore();

  const loadSettings = useCallback(async () => {
    try {
      const loaded = await invoke<AppSettings>("get_settings");
      setSettings(loaded);
      return loaded;
    } catch (error) {
      console.error("Failed to load settings:", error);
      throw error;
    }
  }, [setSettings]);

  const saveSettings = useCallback(
    async (newSettings: AppSettings) => {
      try {
        await invoke("save_settings", { settings: newSettings });
        setSettings(newSettings);
      } catch (error) {
        console.error("Failed to save settings:", error);
        throw error;
      }
    },
    [setSettings]
  );

  const resetSettings = useCallback(async () => {
    try {
      const defaults = await invoke<AppSettings>("reset_settings");
      setSettings(defaults);
      return defaults;
    } catch (error) {
      console.error("Failed to reset settings:", error);
      throw error;
    }
  }, [setSettings]);

  return { settings, loadSettings, saveSettings, resetSettings };
}

// Hook for enrichment modes
export function useEnrichmentModes() {
  const getModes = useCallback(async (): Promise<EnrichmentModeInfo[]> => {
    try {
      return await invoke<EnrichmentModeInfo[]>("get_enrichment_modes");
    } catch (error) {
      console.error("Failed to get enrichment modes:", error);
      throw error;
    }
  }, []);

  return { getModes };
}
