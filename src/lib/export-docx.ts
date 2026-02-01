"use client";

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  AlignmentType,
  BorderStyle,
  PageBreak,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
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

export async function exportToDocx(options: ExportOptions): Promise<Blob> {
  const dateStr = options.timestamp.toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Parse content into paragraphs
  const contentParagraphs = parseContentToParagraphs(options.content);

  // Build document children
  const children: Paragraph[] = [
    // Title
    new Paragraph({
      text: options.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),

    // Metadata
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${dateStr}`,
          size: 20,
          color: "666666",
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Mode: ${MODE_LABELS[options.mode]}`,
          size: 20,
          color: "666666",
        }),
      ],
      spacing: { after: 200 },
    }),

    // Separator
    new Paragraph({
      border: {
        bottom: {
          color: "CCCCCC",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      spacing: { after: 300 },
    }),

    // Content paragraphs
    ...contentParagraphs,
  ];

  // Add original transcription if provided
  if (options.transcription) {
    children.push(
      // Spacer
      new Paragraph({ spacing: { before: 400, after: 200 } }),

      // Separator
      new Paragraph({
        border: {
          bottom: {
            color: "CCCCCC",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: { after: 200 },
      }),

      // Transcription header
      new Paragraph({
        children: [
          new TextRun({
            text: "Original Transcription:",
            bold: true,
            size: 24,
            color: "666666",
          }),
        ],
        spacing: { after: 200 },
      }),

      // Transcription content
      new Paragraph({
        children: [
          new TextRun({
            text: options.transcription,
            italics: true,
            size: 20,
            color: "505050",
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 width in twips
              height: 16838, // A4 height in twips
            },
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [
                      "Page ",
                      PageNumber.CURRENT,
                      " of ",
                      PageNumber.TOTAL_PAGES,
                    ],
                    size: 18,
                    color: "999999",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

function parseContentToParagraphs(content: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      // Empty line = spacer
      paragraphs.push(
        new Paragraph({
          spacing: { after: 100 },
        })
      );
      continue;
    }

    // Check for bullet points
    if (
      trimmedLine.startsWith("- ") ||
      trimmedLine.startsWith("* ") ||
      trimmedLine.startsWith("• ")
    ) {
      const bulletText = trimmedLine.substring(2);
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${bulletText}`,
              size: 24,
            }),
          ],
          indent: { left: 720 }, // 0.5 inch indent
          spacing: { after: 100 },
        })
      );
      continue;
    }

    // Check for numbered lists (1. 2. etc.)
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const [, number, text] = numberedMatch;
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${number}. ${text}`,
              size: 24,
            }),
          ],
          indent: { left: 720 },
          spacing: { after: 100 },
        })
      );
      continue;
    }

    // Check for headings (lines ending with : or all caps)
    if (
      trimmedLine.endsWith(":") ||
      (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3)
    ) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmedLine,
              bold: true,
              size: 26,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      continue;
    }

    // Regular paragraph
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: trimmedLine,
            size: 24,
          }),
        ],
        spacing: { after: 150 },
      })
    );
  }

  return paragraphs;
}

export async function downloadDocx(
  options: ExportOptions,
  filename: string
): Promise<void> {
  const blob = await exportToDocx(options);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
