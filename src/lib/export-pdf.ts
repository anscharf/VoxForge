"use client";

import jsPDF from "jspdf";
import type { EnrichmentMode } from "@/types";

export interface ExportOptions {
  title: string;
  content: string;
  mode: EnrichmentMode;
  timestamp: Date;
  transcription?: string;
}

const MODE_LABELS: Record<EnrichmentMode, string> = {
  email: "E-Mail",
  technical_report: "Technical Report",
  meeting_protocol: "Meeting Protocol",
  bulletpoints: "Bulletpoints",
  custom: "Custom",
};

export async function exportToPDF(options: ExportOptions): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(options.title, margin, yPosition);
  yPosition += 10;

  // Metadata
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  const dateStr = options.timestamp.toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.text(`Generated: ${dateStr}`, margin, yPosition);
  yPosition += 5;
  doc.text(`Mode: ${MODE_LABELS[options.mode]}`, margin, yPosition);
  yPosition += 10;

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Content
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  // Split content into lines that fit the page width
  const lines = doc.splitTextToSize(options.content, contentWidth);

  // Add lines with page break handling
  for (const line of lines) {
    if (yPosition > pageHeight - margin - 10) {
      // Add page number to current page
      addPageNumber(doc, pageHeight, margin);
      // Add new page
      doc.addPage();
      yPosition = margin;
    }
    doc.text(line, margin, yPosition);
    yPosition += 6;
  }

  // Add original transcription if provided
  if (options.transcription) {
    yPosition += 10;

    if (yPosition > pageHeight - margin - 30) {
      addPageNumber(doc, pageHeight, margin);
      doc.addPage();
      yPosition = margin;
    }

    // Separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Transcription section header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Original Transcription:", margin, yPosition);
    yPosition += 8;

    // Transcription content
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80, 80, 80);

    const transcriptionLines = doc.splitTextToSize(
      options.transcription,
      contentWidth
    );

    for (const line of transcriptionLines) {
      if (yPosition > pageHeight - margin - 10) {
        addPageNumber(doc, pageHeight, margin);
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 5;
    }
  }

  // Add page number to last page
  addPageNumber(doc, pageHeight, margin);

  return doc.output("blob");
}

function addPageNumber(doc: jsPDF, pageHeight: number, margin: number) {
  const pageCount = doc.getNumberOfPages();
  const currentPage = doc.getCurrentPageInfo().pageNumber;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Page ${currentPage} of ${pageCount}`,
    doc.internal.pageSize.getWidth() / 2,
    pageHeight - margin / 2,
    { align: "center" }
  );
}

export async function downloadPDF(
  options: ExportOptions,
  filename: string
): Promise<void> {
  const blob = await exportToPDF(options);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
