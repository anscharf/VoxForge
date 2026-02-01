"use client";

import { useCallback, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { downloadPDF } from "@/lib/export-pdf";
import { downloadDocx } from "@/lib/export-docx";
import toast from "react-hot-toast";

export function ExportButtons() {
  const { enrichedText, transcription, enrichmentMode } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);

  const hasContent = enrichedText.trim().length > 0;

  const handleCopyToClipboard = useCallback(async () => {
    if (!hasContent) return;

    try {
      await navigator.clipboard.writeText(enrichedText);
      toast.success("In Zwischenablage kopiert!");
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Kopieren fehlgeschlagen");
    }
  }, [enrichedText, hasContent]);

  const handleExportPDF = useCallback(async () => {
    if (!hasContent) return;

    setIsExporting(true);
    try {
      const timestamp = new Date();
      const filename = `voxforge-${timestamp.toISOString().slice(0, 10)}.pdf`;

      await downloadPDF(
        {
          title: "VoxForge Export",
          content: enrichedText,
          mode: enrichmentMode,
          timestamp,
          transcription: transcription || undefined,
        },
        filename
      );

      toast.success("PDF erfolgreich exportiert!");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("PDF-Export fehlgeschlagen");
    } finally {
      setIsExporting(false);
    }
  }, [enrichedText, transcription, enrichmentMode, hasContent]);

  const handleExportDocx = useCallback(async () => {
    if (!hasContent) return;

    setIsExporting(true);
    try {
      const timestamp = new Date();
      const filename = `voxforge-${timestamp.toISOString().slice(0, 10)}.docx`;

      await downloadDocx(
        {
          title: "VoxForge Export",
          content: enrichedText,
          mode: enrichmentMode,
          timestamp,
          transcription: transcription || undefined,
        },
        filename
      );

      toast.success("Word-Dokument erfolgreich exportiert!");
    } catch (error) {
      console.error("DOCX export failed:", error);
      toast.error("Word-Export fehlgeschlagen");
    } finally {
      setIsExporting(false);
    }
  }, [enrichedText, transcription, enrichmentMode, hasContent]);

  return (
    <div className="flex flex-wrap gap-3">
      {/* Copy to clipboard */}
      <button
        onClick={handleCopyToClipboard}
        disabled={!hasContent}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          transition-all duration-200
          ${
            !hasContent
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700 shadow-sm hover:shadow"
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Kopieren
      </button>

      {/* Export to PDF */}
      <button
        onClick={handleExportPDF}
        disabled={!hasContent || isExporting}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          transition-all duration-200
          ${
            !hasContent || isExporting
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-red-100 hover:bg-red-200 text-red-700 shadow-sm hover:shadow"
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        PDF
      </button>

      {/* Export to DOCX */}
      <button
        onClick={handleExportDocx}
        disabled={!hasContent || isExporting}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          transition-all duration-200
          ${
            !hasContent || isExporting
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-100 hover:bg-blue-200 text-blue-700 shadow-sm hover:shadow"
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Word
      </button>
    </div>
  );
}
