"use client";

import { useEffect } from "react";
import {
  AudioRecorder,
  TranscriptionView,
  EnrichmentPanel,
  ExportButtons,
  OllamaStatus,
  SettingsPanel,
} from "@/components";
import { TauriEventProvider } from "@/components/TauriEventProvider";
import { useSettings } from "@/hooks/useTauri";
import { useAppStore } from "@/stores/appStore";

export default function Home() {
  const { showSettings, setShowSettings } = useAppStore();
  const { loadSettings } = useSettings();

  // Load settings on mount
  useEffect(() => {
    loadSettings().catch(console.error);
  }, [loadSettings]);

  return (
    <TauriEventProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                VoxForge
              </h1>
              <p className="text-xs text-slate-500">
                Aufnehmen, Transkribieren, Anreichern
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <OllamaStatus />
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              title="Einstellungen"
            >
              <svg
                className="w-5 h-5 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Recording section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <AudioRecorder />
          </section>

          {/* Transcription section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <TranscriptionView />
          </section>

          {/* Enrichment section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <EnrichmentPanel />
          </section>

          {/* Export section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-medium text-gray-700">Exportieren</h3>
              <ExportButtons />
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-8 text-center text-sm text-slate-500">
        <p>
          VoxForge v1.0.0 • Erstellt mit Next.js + Tauri + Whisper + Ollama
        </p>
      </footer>

      {/* Settings Panel */}
      <SettingsPanel />
    </div>
    </TauriEventProvider>
  );
}
