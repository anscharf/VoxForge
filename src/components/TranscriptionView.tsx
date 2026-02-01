"use client";

import { useAppStore } from "@/stores/appStore";

export function TranscriptionView() {
  const { transcription, setTranscription, isTranscribing } = useAppStore();

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">
        Transkription
        {isTranscribing && (
          <span className="ml-2 text-blue-500 animate-pulse">
            (Transkribieren...)
          </span>
        )}
      </label>
      <textarea
        value={transcription}
        onChange={(e) => setTranscription(e.target.value)}
        placeholder="Dein transkribierter Text erscheint hier. Du kannst auch direkt Text eingeben oder einfügen."
        className="w-full h-40 p-4 border border-gray-300 rounded-lg resize-none
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          text-gray-800 placeholder-gray-400
          disabled:bg-gray-100 disabled:cursor-not-allowed"
        disabled={isTranscribing}
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{transcription.length} Zeichen</span>
        <span>{transcription.split(/\s+/).filter(Boolean).length} Wörter</span>
      </div>
    </div>
  );
}
