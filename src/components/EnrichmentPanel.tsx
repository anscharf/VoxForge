"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { useEnrichment, useEnrichmentModes } from "@/hooks/useTauri";
import type { EnrichmentMode, EnrichmentModeInfo } from "@/types";

export function EnrichmentPanel() {
  const {
    transcription,
    enrichedText,
    enrichmentMode,
    setEnrichmentMode,
    customPrompt,
    setCustomPrompt,
    isEnriching,
    setEnrichedText,
  } = useAppStore();

  const { enrich } = useEnrichment();
  const { getModes } = useEnrichmentModes();
  const [modes, setModes] = useState<EnrichmentModeInfo[]>([]);

  // Load enrichment modes on mount
  useEffect(() => {
    getModes()
      .then(setModes)
      .catch((err) => {
        console.error("Failed to load enrichment modes:", err);
        // Fallback modes
        setModes([
          { id: "email", label: "E-Mail", description: "Als E-Mail formatieren" },
          { id: "technical_report", label: "Technischer Bericht", description: "Als Bericht formatieren" },
          { id: "meeting_protocol", label: "Besprechungsprotokoll", description: "Als Protokoll formatieren" },
          { id: "bulletpoints", label: "Stichpunkte", description: "Als Aufzählung formatieren" },
          { id: "custom", label: "Benutzerdefiniert", description: "Eigenen Prompt verwenden" },
        ]);
      });
  }, [getModes]);

  const handleEnrich = useCallback(async () => {
    if (!transcription.trim()) {
      return;
    }

    try {
      setEnrichedText(""); // Clear previous
      await enrich(transcription);
    } catch (error) {
      console.error("Enrichment failed:", error);
    }
  }, [transcription, enrich, setEnrichedText]);

  return (
    <div className="flex flex-col gap-4">
      {/* Mode selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">
          Anreicherungsmodus
        </label>
        <div className="flex flex-wrap gap-2">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setEnrichmentMode(mode.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  enrichmentMode === mode.id
                    ? "bg-blue-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
              title={mode.description}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom prompt input */}
      {enrichmentMode === "custom" && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            Eigener Prompt
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Gib deine eigenen Anweisungen für die Verarbeitung der Transkription ein..."
            className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              text-gray-800 placeholder-gray-400"
          />
        </div>
      )}

      {/* Enrich button */}
      <button
        onClick={handleEnrich}
        disabled={!transcription.trim() || isEnriching}
        className={`
          flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium
          transition-all duration-200
          ${
            !transcription.trim() || isEnriching
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg"
          }
        `}
      >
        {isEnriching ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
            <span>Anreichern...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>Text anreichern</span>
          </>
        )}
      </button>

      {/* Enriched text output */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">
          Ergebnis
          {isEnriching && (
            <span className="ml-2 text-green-500 animate-pulse">
              (Generieren...)
            </span>
          )}
        </label>
        <div
          className="w-full min-h-[200px] max-h-[400px] p-4 border border-gray-300 rounded-lg
            overflow-y-auto bg-gray-50 text-gray-800 whitespace-pre-wrap"
        >
          {enrichedText || (
            <span className="text-gray-400 italic">
              Der angereicherte Text erscheint hier nach der Verarbeitung.
            </span>
          )}
        </div>
        {enrichedText && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>{enrichedText.length} Zeichen</span>
            <span>
              {enrichedText.split(/\s+/).filter(Boolean).length} Wörter
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
