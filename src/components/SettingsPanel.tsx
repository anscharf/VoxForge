"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { useSettings } from "@/hooks/useTauri";
import type { AIProvider, TranscriptionProvider, AppSettings } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import toast from "react-hot-toast";

interface OpenAIStatus {
  status: "ready" | "no_api_key" | "invalid_api_key" | "error";
}

export function SettingsPanel() {
  const { settings, setSettings, showSettings, setShowSettings } = useAppStore();
  const { saveSettings } = useSettings();

  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [openaiStatus, setOpenaiStatus] = useState<OpenAIStatus | null>(null);
  const [isCheckingKey, setIsCheckingKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize local settings from store
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        ...settings,
        // Ensure new fields have defaults
        aiProvider: settings.aiProvider || "ollama",
        transcriptionProvider: settings.transcriptionProvider || "whisper",
        openaiApiKey: settings.openaiApiKey || "",
        openaiModel: settings.openaiModel || "gpt-4o-mini",
        openaiTranscriptionModel: settings.openaiTranscriptionModel || "whisper-1",
      });
    }
  }, [settings]);

  // Check OpenAI API key when it changes
  const checkApiKey = useCallback(async (apiKey: string) => {
    if (!apiKey.trim()) {
      setOpenaiStatus({ status: "no_api_key" });
      return;
    }

    setIsCheckingKey(true);
    try {
      const status = await invoke<OpenAIStatus>("check_openai_api_key", {
        apiKey,
      });
      setOpenaiStatus(status);
    } catch (error) {
      console.error("Failed to check API key:", error);
      setOpenaiStatus({ status: "error" });
    } finally {
      setIsCheckingKey(false);
    }
  }, []);

  // Update a local setting
  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : null));
    },
    []
  );

  // Save settings
  const handleSave = useCallback(async () => {
    if (!localSettings) return;

    setIsSaving(true);
    try {
      await saveSettings(localSettings);
      setSettings(localSettings);
      toast.success("Einstellungen gespeichert!");
      setShowSettings(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }, [localSettings, saveSettings, setSettings, setShowSettings]);

  // Cancel and close
  const handleCancel = useCallback(() => {
    setLocalSettings(settings);
    setShowSettings(false);
  }, [settings, setShowSettings]);

  if (!showSettings || !localSettings) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Einstellungen</h2>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-8">
          {/* AI Provider Section */}
          <section>
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              KI-Anbieter für Textanreicherung
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => updateSetting("aiProvider", "ollama")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  localSettings.aiProvider === "ollama"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 ${
                      localSettings.aiProvider === "ollama"
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {localSettings.aiProvider === "ollama" && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">Ollama (Lokal)</p>
                    <p className="text-sm text-gray-500">
                      Kostenlos, läuft auf deinem Computer
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => updateSetting("aiProvider", "openai")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  localSettings.aiProvider === "openai"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 ${
                      localSettings.aiProvider === "openai"
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {localSettings.aiProvider === "openai" && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">OpenAI</p>
                    <p className="text-sm text-gray-500">
                      Cloud-basiert, benötigt API-Key
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* Transcription Provider Section */}
          <section>
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              Transkriptions-Anbieter
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => updateSetting("transcriptionProvider", "whisper")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  localSettings.transcriptionProvider === "whisper"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 ${
                      localSettings.transcriptionProvider === "whisper"
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {localSettings.transcriptionProvider === "whisper" && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">Whisper (Lokal)</p>
                    <p className="text-sm text-gray-500">
                      Kostenlos, läuft offline
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => updateSetting("transcriptionProvider", "openai")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  localSettings.transcriptionProvider === "openai"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 ${
                      localSettings.transcriptionProvider === "openai"
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {localSettings.transcriptionProvider === "openai" && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">OpenAI Whisper</p>
                    <p className="text-sm text-gray-500">
                      Cloud-basiert, höhere Qualität
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* OpenAI Settings (shown when OpenAI is selected) */}
          {(localSettings.aiProvider === "openai" ||
            localSettings.transcriptionProvider === "openai") && (
            <section className="p-4 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                OpenAI Einstellungen
              </h3>

              {/* API Key */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API-Schlüssel
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={localSettings.openaiApiKey}
                    onChange={(e) => updateSetting("openaiApiKey", e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => checkApiKey(localSettings.openaiApiKey)}
                    disabled={isCheckingKey}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {isCheckingKey ? "Prüfen..." : "Prüfen"}
                  </button>
                </div>
                {openaiStatus && (
                  <div
                    className={`mt-2 text-sm ${
                      openaiStatus.status === "ready"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {openaiStatus.status === "ready" && "✓ API-Schlüssel gültig"}
                    {openaiStatus.status === "no_api_key" &&
                      "Bitte API-Schlüssel eingeben"}
                    {openaiStatus.status === "invalid_api_key" &&
                      "✗ API-Schlüssel ungültig"}
                    {openaiStatus.status === "error" && "✗ Fehler bei der Prüfung"}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Hole dir deinen API-Schlüssel von{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>

              {/* OpenAI Model for Enrichment */}
              {localSettings.aiProvider === "openai" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modell für Textanreicherung
                  </label>
                  <select
                    value={localSettings.openaiModel}
                    onChange={(e) => updateSetting("openaiModel", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gpt-4o">GPT-4o (Beste Qualität)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Schneller, günstiger)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Am günstigsten)</option>
                  </select>
                </div>
              )}

              {/* OpenAI Model for Transcription */}
              {localSettings.transcriptionProvider === "openai" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modell für Transkription
                  </label>
                  <select
                    value={localSettings.openaiTranscriptionModel}
                    onChange={(e) =>
                      updateSetting("openaiTranscriptionModel", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="whisper-1">Whisper-1</option>
                  </select>
                </div>
              )}
            </section>
          )}

          {/* Ollama Settings (shown when Ollama is selected) */}
          {localSettings.aiProvider === "ollama" && (
            <section className="p-4 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Ollama Einstellungen
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ollama URL
                </label>
                <input
                  type="text"
                  value={localSettings.ollamaUrl}
                  onChange={(e) => updateSetting("ollamaUrl", e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modell
                </label>
                <input
                  type="text"
                  value={localSettings.ollamaModel}
                  onChange={(e) => updateSetting("ollamaModel", e.target.value)}
                  placeholder="llama3.2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </section>
          )}

          {/* Whisper Settings (shown when Whisper is selected) */}
          {localSettings.transcriptionProvider === "whisper" && (
            <section className="p-4 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Whisper Einstellungen
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modellgröße
                </label>
                <select
                  value={localSettings.whisperModel}
                  onChange={(e) => updateSetting("whisperModel", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="tiny">Tiny (Schnellste)</option>
                  <option value="base">Base (Empfohlen)</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large (Beste Qualität)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sprache
                </label>
                <select
                  value={localSettings.language}
                  onChange={(e) => updateSetting("language", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Automatisch erkennen</option>
                  <option value="de">Deutsch</option>
                  <option value="en">Englisch</option>
                </select>
              </div>
            </section>
          )}

          {/* General Settings */}
          <section>
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              Allgemeine Einstellungen
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tastenkürzel für Aufnahme
                </label>
                <input
                  type="text"
                  value={localSettings.hotkey}
                  onChange={(e) => updateSetting("hotkey", e.target.value)}
                  placeholder="CommandOrControl+Shift+R"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="minimizeToTray"
                  checked={localSettings.minimizeToTray}
                  onChange={(e) =>
                    updateSetting("minimizeToTray", e.target.checked)
                  }
                  className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="minimizeToTray"
                  className="text-sm text-gray-700"
                >
                  Beim Schließen in System Tray minimieren
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="startMinimized"
                  checked={localSettings.startMinimized}
                  onChange={(e) =>
                    updateSetting("startMinimized", e.target.checked)
                  }
                  className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="startMinimized"
                  className="text-sm text-gray-700"
                >
                  Minimiert starten
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl">
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCancel}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isSaving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
