// lib/ai/claude.ts
// Claude Sonnet 4.5 analyzer — same contract as lib/ai/gemini.ts
// (analyzeMultimodal) but uses Anthropic's Messages API.
//
// Differences from the GPT-4o path:
//   - Claude reads PDFs NATIVELY via { type: "document", source: ... } — no
//     unpdf text extraction needed for it.
//   - Image media_type is a strict union ("image/jpeg" | "image/png" | ...).
//   - There is no JSON mode flag — we ask for JSON in the prompt and parse
//     the first {...} block from the response.

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./clients";
import { extractPdfText } from "./pdf-extract";
import type { GeminiInlineFile, EvidenceInspection } from "./gemini";

const CLAUDE_MODEL = MODELS.CLAUDE_SONNET;

export type ClaudeAnalyzeResult = {
  raw: string;
  inspection: EvidenceInspection;
};

const ALLOWED_IMAGE_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type ImageMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function normalizeImageMime(mime: string): ImageMedia {
  return ALLOWED_IMAGE_MEDIA.has(mime) ? (mime as ImageMedia) : "image/png";
}

async function buildClaudeContent(
  userPrompt: string,
  files: GeminiInlineFile[]
): Promise<{
  blocks: Anthropic.Messages.ContentBlockParam[];
  inspection: EvidenceInspection;
}> {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [
    { type: "text", text: userPrompt },
  ];
  const inspection: EvidenceInspection = {
    imageCount: 0,
    pdfCount: 0,
    pdfPagesRead: 0,
    pdfCharsExtracted: 0,
    scannedPdfCount: 0,
  };

  let imgIdx = 0;
  let pdfIdx = 0;

  for (const f of files) {
    if (f.mimeType.startsWith("image/")) {
      imgIdx++;
      inspection.imageCount++;
      blocks.push({
        type: "text",
        text: `\n--- IMAGE ${imgIdx}${f.docType ? ` (docType=${f.docType})` : ""} ---`,
      });
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: normalizeImageMime(f.mimeType),
          data: f.base64,
        },
      });
    } else if (f.mimeType === "application/pdf") {
      pdfIdx++;
      inspection.pdfCount++;
      // Inspection-stats parity with GPT path (Claude reads PDF natively).
      const bytes = Uint8Array.from(Buffer.from(f.base64, "base64"));
      const result = await extractPdfText(bytes);
      inspection.pdfPagesRead += result.numPages;
      inspection.pdfCharsExtracted += result.text.length;
      if (result.isLikelyScanned) inspection.scannedPdfCount++;

      blocks.push({
        type: "text",
        text: `\n--- DOCUMENT ${pdfIdx}${f.docType ? ` (docType=${f.docType})` : ""} | ${result.numPages} page(s) ---`,
      });
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: f.base64,
        },
      });
    }
  }

  return { blocks, inspection };
}

function extractFirstJson(text: string): string {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (cleaned.startsWith("{")) return cleaned;
  const m = cleaned.match(/\{[\s\S]+\}/);
  return m ? m[0] : cleaned;
}

/**
 * Run the same analysis prompt against Claude Sonnet 4.5 with the same
 * evidence package the GPT-4o path receives. Returns the raw string + the
 * inspection counters for the orchestrator.
 */
export async function analyzeWithClaude(
  systemInstruction: string,
  userPrompt: string,
  files: GeminiInlineFile[]
): Promise<ClaudeAnalyzeResult> {
  const client = getAnthropic();
  const { blocks, inspection } = await buildClaudeContent(userPrompt, files);

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    temperature: 0.1,
    system: systemInstruction,
    messages: [{ role: "user", content: blocks }],
  });

  const text = response.content
    .filter(
      (b): b is Anthropic.Messages.TextBlock => b.type === "text"
    )
    .map((b) => b.text)
    .join("\n");

  return {
    raw: extractFirstJson(text),
    inspection,
  };
}
