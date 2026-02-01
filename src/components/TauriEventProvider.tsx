"use client";

import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "@/stores/appStore";

/**
 * Global event listener provider for Tauri events.
 * This component ensures that streaming events (ollama-stream, ollama-done)
 * are only listened to once, preventing duplicate text in the output.
 */
export function TauriEventProvider({ children }: { children: React.ReactNode }) {
  const listenersInitialized = useRef(false);
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    // Prevent multiple initializations (React StrictMode protection)
    if (listenersInitialized.current) return;
    listenersInitialized.current = true;

    const setupListeners = async () => {
      // Streaming chunks from LLM (both Ollama and OpenAI use this event)
      const unlistenStream = await listen<string>("ollama-stream", (event) => {
        useAppStore.getState().appendEnrichedText(event.payload);
      });
      unlistenRefs.current.push(unlistenStream);

      // Stream completion
      const unlistenDone = await listen("ollama-done", () => {
        useAppStore.getState().setIsEnriching(false);
        useAppStore.getState().setRecordingState("idle");
      });
      unlistenRefs.current.push(unlistenDone);

      // Audio level updates
      const unlistenLevel = await listen<number>("audio-level", (event) => {
        useAppStore.getState().setAudioLevel(event.payload);
      });
      unlistenRefs.current.push(unlistenLevel);

      // Recording started
      const unlistenStarted = await listen("recording-started", () => {
        useAppStore.getState().setRecordingState("recording");
      });
      unlistenRefs.current.push(unlistenStarted);

      // Recording stopped
      const unlistenStopped = await listen<string>("recording-stopped", (event) => {
        useAppStore.getState().setAudioPath(event.payload);
        useAppStore.getState().setRecordingState("processing");
      });
      unlistenRefs.current.push(unlistenStopped);

      // Toggle recording event (from global hotkey)
      const unlistenToggle = await listen("toggle-recording", async () => {
        const state = useAppStore.getState();
        const currentState = state.recordingState;

        console.log("[TauriEventProvider] toggle-recording event, currentState:", currentState);

        if (currentState === "recording") {
          // Stop recording and transcribe
          try {
            state.setRecordingState("processing");
            const audioPath = await invoke<string>("stop_recording");
            console.log("[TauriEventProvider] Recording stopped, audioPath:", audioPath);
            state.setAudioPath(audioPath);

            // Automatically transcribe after recording
            state.setRecordingState("transcribing");
            state.setIsTranscribing(true);

            try {
              // Re-fetch settings from store to get latest values
              const currentSettings = useAppStore.getState().settings;
              console.log("[TauriEventProvider] Starting transcription with settings:", currentSettings);
              let transcriptionText: string;

              // Check if we should use OpenAI for transcription
              if (currentSettings?.transcriptionProvider === "openai" && currentSettings?.openaiApiKey) {
                console.log("[TauriEventProvider] Using OpenAI for transcription");
                transcriptionText = await invoke<string>("openai_transcribe", {
                  request: {
                    audio_path: audioPath,
                    api_key: currentSettings.openaiApiKey,
                    model: currentSettings.openaiTranscriptionModel || "whisper-1",
                    language: currentSettings.language !== "auto" ? currentSettings.language : null,
                  },
                });
              } else {
                // Use local Whisper
                console.log("[TauriEventProvider] Using local Whisper for transcription");
                const response = await invoke<{ text: string }>("transcribe", {
                  request: {
                    audio_path: audioPath,
                    model: currentSettings?.whisperModel || "base",
                    language: currentSettings?.language || "auto",
                  },
                });
                transcriptionText = response.text;
              }

              console.log("[TauriEventProvider] Transcription complete:", transcriptionText?.substring(0, 100));
              state.setTranscription(transcriptionText);
              state.setRecordingState("idle");
            } catch (transcribeError) {
              console.error("[TauriEventProvider] Failed to transcribe:", transcribeError);
              state.setRecordingState("idle");
            } finally {
              state.setIsTranscribing(false);
            }
          } catch (error) {
            console.error("[TauriEventProvider] Failed to stop recording:", error);
            state.setRecordingState("idle");
          }
        } else if (currentState === "idle") {
          // Start recording
          try {
            console.log("[TauriEventProvider] Starting recording...");
            await invoke("start_recording");
            state.setRecordingState("recording");
            console.log("[TauriEventProvider] Recording started");
          } catch (error) {
            console.error("[TauriEventProvider] Failed to start recording:", error);
            state.setRecordingState("idle");
          }
        }
      });
      unlistenRefs.current.push(unlistenToggle);
    };

    setupListeners();

    return () => {
      unlistenRefs.current.forEach((unlisten) => unlisten());
      unlistenRefs.current = [];
      listenersInitialized.current = false;
    };
  }, []);

  return <>{children}</>;
}
