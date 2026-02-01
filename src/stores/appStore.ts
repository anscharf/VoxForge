"use client";

import { create } from "zustand";
import type {
  RecordingState,
  EnrichmentMode,
  OllamaSetupStatus,
  AppSettings,
} from "@/types";

interface AppState {
  // Recording state
  recordingState: RecordingState;
  audioLevel: number;
  audioPath: string | null;

  // Transcription
  transcription: string;
  isTranscribing: boolean;

  // Enrichment
  enrichedText: string;
  enrichmentMode: EnrichmentMode;
  customPrompt: string;
  isEnriching: boolean;

  // Ollama status
  ollamaStatus: OllamaSetupStatus | null;

  // Settings
  settings: AppSettings | null;

  // UI state
  showSettings: boolean;

  // Actions
  setRecordingState: (state: RecordingState) => void;
  setAudioLevel: (level: number) => void;
  setAudioPath: (path: string | null) => void;
  setTranscription: (text: string) => void;
  setIsTranscribing: (value: boolean) => void;
  setEnrichedText: (text: string) => void;
  appendEnrichedText: (text: string) => void;
  setEnrichmentMode: (mode: EnrichmentMode) => void;
  setCustomPrompt: (prompt: string) => void;
  setIsEnriching: (value: boolean) => void;
  setOllamaStatus: (status: OllamaSetupStatus | null) => void;
  setSettings: (settings: AppSettings | null) => void;
  setShowSettings: (show: boolean) => void;
  reset: () => void;
}

const initialState = {
  recordingState: "idle" as RecordingState,
  audioLevel: 0,
  audioPath: null,
  transcription: "",
  isTranscribing: false,
  enrichedText: "",
  enrichmentMode: "bulletpoints" as EnrichmentMode,
  customPrompt: "",
  isEnriching: false,
  ollamaStatus: null,
  settings: null,
  showSettings: false,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setRecordingState: (state) => set({ recordingState: state }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setAudioPath: (path) => set({ audioPath: path }),
  setTranscription: (text) => set({ transcription: text }),
  setIsTranscribing: (value) => set({ isTranscribing: value }),
  setEnrichedText: (text) => set({ enrichedText: text }),
  appendEnrichedText: (text) =>
    set((state) => ({ enrichedText: state.enrichedText + text })),
  setEnrichmentMode: (mode) => set({ enrichmentMode: mode }),
  setCustomPrompt: (prompt) => set({ customPrompt: prompt }),
  setIsEnriching: (value) => set({ isEnriching: value }),
  setOllamaStatus: (status) => set({ ollamaStatus: status }),
  setSettings: (settings) => set({ settings }),
  setShowSettings: (show) => set({ showSettings: show }),
  reset: () =>
    set({
      ...initialState,
      settings: null, // Keep settings
    }),
}));
