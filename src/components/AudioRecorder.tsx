"use client";

import { useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { useRecording, useTranscription, useEnrichment } from "@/hooks/useTauri";
import { AudioVisualizer } from "./AudioVisualizer";
import toast from "react-hot-toast";

export function AudioRecorder() {
  const {
    recordingState,
    audioLevel,
    audioPath,
    transcription,
    isTranscribing,
    isEnriching,
  } = useAppStore();

  const { startRecording, stopRecording, toggleRecording } = useRecording();
  const { transcribe } = useTranscription();
  const { enrich } = useEnrichment();

  const handleRecordingToggle = useCallback(async () => {
    console.log("[AudioRecorder] handleRecordingToggle, current state:", recordingState);
    try {
      if (recordingState === "idle") {
        console.log("[AudioRecorder] Starting recording...");
        toast.success("Aufnahme gestartet");
        await startRecording();
        console.log("[AudioRecorder] Recording started");
      } else if (recordingState === "recording") {
        console.log("[AudioRecorder] Stopping recording...");
        toast.loading("Aufnahme wird gestoppt...", { id: "recording" });
        const path = await stopRecording();
        console.log("[AudioRecorder] Recording stopped, path:", path);
        toast.success(`Aufnahme gespeichert: ${path.split("/").pop()}`, { id: "recording" });
        // Automatically transcribe after recording
        console.log("[AudioRecorder] Starting transcription...");
        await transcribe(path);
        console.log("[AudioRecorder] Transcription complete");
      }
    } catch (error) {
      console.error("[AudioRecorder] Recording error:", error);
      toast.error(`Fehler: ${error}`);
    }
  }, [recordingState, startRecording, stopRecording, transcribe]);

  const getButtonText = () => {
    switch (recordingState) {
      case "recording":
        return "Aufnahme stoppen";
      case "processing":
        return "Verarbeiten...";
      case "transcribing":
        return "Transkribieren...";
      case "enriching":
        return "Anreichern...";
      default:
        return "Aufnahme starten";
    }
  };

  const getButtonIcon = () => {
    switch (recordingState) {
      case "recording":
        return (
          <svg
            className="w-6 h-6"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        );
      case "processing":
      case "transcribing":
      case "enriching":
        return (
          <svg
            className="w-6 h-6 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-6 h-6"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        );
    }
  };

  const isDisabled =
    recordingState === "processing" ||
    recordingState === "transcribing" ||
    recordingState === "enriching";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Recording button */}
      <button
        onClick={handleRecordingToggle}
        disabled={isDisabled}
        className={`
          flex items-center gap-3 px-6 py-4 rounded-xl font-medium text-lg
          transition-all duration-200 transform
          ${
            recordingState === "recording"
              ? "bg-red-500 hover:bg-red-600 text-white scale-105 animate-pulse"
              : isDisabled
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white hover:scale-105"
          }
          shadow-lg hover:shadow-xl
        `}
      >
        {getButtonIcon()}
        <span>{getButtonText()}</span>
      </button>

      {/* Audio visualizer */}
      {recordingState === "recording" && (
        <AudioVisualizer level={audioLevel} />
      )}

      {/* Hotkey hint */}
      <p className="text-sm text-gray-500">
        Drücke <kbd className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">Cmd/Ctrl+Shift+R</kbd> zum Aufnehmen
      </p>
    </div>
  );
}
