"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { useOllamaStatus } from "@/hooks/useTauri";
import { invoke } from "@tauri-apps/api/core";

interface OpenAIStatus {
  status: "ready" | "no_api_key" | "invalid_api_key" | "error";
}

export function OllamaStatus() {
  const { ollamaStatus, settings } = useAppStore();
  const { checkStatus } = useOllamaStatus();
  const [openaiStatus, setOpenaiStatus] = useState<OpenAIStatus | null>(null);

  // Determine which provider is being used
  const isUsingOpenAI = settings?.aiProvider === "openai";

  // Check OpenAI status
  const checkOpenAIStatus = useCallback(async () => {
    if (!settings?.openaiApiKey) {
      setOpenaiStatus({ status: "no_api_key" });
      return;
    }

    try {
      const status = await invoke<OpenAIStatus>("check_openai_api_key", {
        apiKey: settings.openaiApiKey,
      });
      setOpenaiStatus(status);
    } catch (error) {
      console.error("Failed to check OpenAI status:", error);
      setOpenaiStatus({ status: "error" });
    }
  }, [settings?.openaiApiKey]);

  // Check status on mount and when provider changes
  useEffect(() => {
    if (isUsingOpenAI) {
      checkOpenAIStatus().catch(console.error);
    } else {
      checkStatus().catch(console.error);
    }
  }, [isUsingOpenAI, checkStatus, checkOpenAIStatus]);

  // OpenAI Status Display
  if (isUsingOpenAI) {
    if (!openaiStatus) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
          Prüfe OpenAI...
        </div>
      );
    }

    if (openaiStatus.status === "ready") {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          OpenAI bereit
        </div>
      );
    }

    if (openaiStatus.status === "no_api_key") {
      return (
        <div className="flex items-center gap-2 text-sm text-yellow-600">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          API-Key fehlt
        </div>
      );
    }

    if (openaiStatus.status === "invalid_api_key") {
      return (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          API-Key ungültig
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        OpenAI Fehler
      </div>
    );
  }

  // Ollama Status Display
  if (!ollamaStatus) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
        Prüfe Ollama...
      </div>
    );
  }

  if (ollamaStatus.status === "ready") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600" title={`Verbunden mit ${ollamaStatus.url}`}>
        <div className="w-2 h-2 rounded-full bg-green-500" />
        Ollama bereit
      </div>
    );
  }

  if (ollamaStatus.status === "not_running") {
    return (
      <div className="flex flex-col gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-yellow-700">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="font-medium">Ollama nicht erreichbar</span>
        </div>
        <p className="text-xs text-yellow-600 whitespace-pre-line">
          {ollamaStatus.suggestion}
        </p>
        <details className="text-xs text-yellow-600">
          <summary className="cursor-pointer hover:text-yellow-700">Getestete URLs anzeigen</summary>
          <ul className="mt-1 font-mono bg-yellow-100 p-2 rounded list-disc list-inside">
            {ollamaStatus.urls_tried.map((url, i) => (
              <li key={i}>{url}</li>
            ))}
          </ul>
        </details>
        <div className="text-xs text-yellow-600 font-mono bg-yellow-100 p-2 rounded mt-2">
          <p>1. Ollama installieren von <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline">ollama.com</a></p>
          <p>2. Ollama starten</p>
          <p>3. Ausführen: <code>ollama pull llama3.2</code></p>
        </div>
        <button
          onClick={() => checkStatus()}
          className="mt-2 text-xs text-yellow-700 underline hover:text-yellow-800"
        >
          Erneut prüfen
        </button>
      </div>
    );
  }

  if (ollamaStatus.status === "error") {
    return (
      <div className="flex flex-col gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="font-medium">Ollama Fehler</span>
        </div>
        <p className="text-xs text-red-600">
          {ollamaStatus.message}
        </p>
        <p className="text-xs text-red-500">
          URL: {ollamaStatus.url}
        </p>
        <button
          onClick={() => checkStatus()}
          className="mt-2 text-xs text-red-700 underline hover:text-red-800"
        >
          Erneut prüfen
        </button>
      </div>
    );
  }

  if (ollamaStatus.status === "missing_model") {
    return (
      <div className="flex flex-col gap-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-orange-700">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="font-medium">Modell &quot;{ollamaStatus.model}&quot; nicht gefunden</span>
        </div>
        <p className="text-xs text-orange-600">
          Das benötigte Modell ist nicht installiert.
        </p>
        {ollamaStatus.available_models.length > 0 && (
          <details className="text-xs text-orange-600">
            <summary className="cursor-pointer hover:text-orange-700">Verfügbare Modelle ({ollamaStatus.available_models.length})</summary>
            <ul className="mt-1 font-mono bg-orange-100 p-2 rounded list-disc list-inside max-h-24 overflow-y-auto">
              {ollamaStatus.available_models.map((model, i) => (
                <li key={i}>{model}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="text-xs text-orange-600 font-mono bg-orange-100 p-2 rounded mt-2">
          Ausführen: <code>ollama pull {ollamaStatus.model}</code>
        </div>
        <button
          onClick={() => checkStatus()}
          className="mt-2 text-xs text-orange-700 underline hover:text-orange-800"
        >
          Erneut prüfen
        </button>
      </div>
    );
  }

  return null;
}
