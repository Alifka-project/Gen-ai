// lib/ai/gemini.ts
// OpenAI GPT-4o client for multimodal analysis with REAL PDF text extraction.
// Filename kept for minimal import changes across the codebase.
//
// Anti-hallucination measures applied here:
//   - PDF bytes are extracted to text via lib/ai/pdf-extract.ts (was previously
//     stubbed with a placeholder "[PDF uploaded]" text, which caused the model
//     to invent document_analysis values out of thin air).
//   - Each evidence part is preceded by a labelled marker so the system prompt
//     can refer back to it ("IMAGE 1", "INVOICE 1", etc.).

import OpenAI from "openai";
import { extractPdfText } from "./pdf-extract";

export const FLASH_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export type GeminiInlineFile = {
  mimeType: string;
  base64: string;
  /** Optional label so the prompt can reference the file ("invoice", "damage photo"). */
  docType?: string;
};

/** Per-file evidence summary returned alongside the model output. Stored on
 * AiAnalysis.explanationJson.evidence_inspected so the dashboard can show what
 * the model actually saw (vs what it claims). */
export type EvidenceInspection = {
  imageCount: number;
  pdfCount: number;
  pdfPagesRead: number;
  pdfCharsExtracted: number;
  scannedPdfCount: number;
};

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to .env.local or Vercel environment variables."
      );
    }
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

/**
 * Build the multimodal content parts for one user message:
 *   - text prompt first
 *   - each image as image_url (data URI, detail=high)
 *   - each PDF as extracted-text block (NOT a stub)
 *
 * Returns the content parts AND a structured evidence-inspection report so
 * the orchestrator can record provenance.
 */
async function buildContentParts(
  userPrompt: string,
  files: GeminiInlineFile[]
): Promise<{
  parts: OpenAI.ChatCompletionContentPart[];
  inspection: EvidenceInspection;
}> {
  const parts: OpenAI.ChatCompletionContentPart[] = [
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
      parts.push({
        type: "text",
        text: `\n--- IMAGE ${imgIdx}${f.docType ? ` (docType=${f.docType})` : ""} ---`,
      });
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${f.mimeType};base64,${f.base64}`,
          detail: "high",
        },
      });
    } else if (f.mimeType === "application/pdf") {
      pdfIdx++;
      inspection.pdfCount++;
      const bytes = Uint8Array.from(Buffer.from(f.base64, "base64"));
      const result = await extractPdfText(bytes);
      inspection.pdfPagesRead += result.numPages;
      inspection.pdfCharsExtracted += result.text.length;
      if (result.isLikelyScanned) inspection.scannedPdfCount++;

      if (result.text.trim().length > 0) {
        parts.push({
          type: "text",
          text: `\n--- DOCUMENT ${pdfIdx}${f.docType ? ` (docType=${f.docType})` : ""} | extracted text from ${result.numPages} page(s) ---\n${result.text.slice(0, 30000)}`,
        });
      } else {
        // Scanned PDF — flag it. Do NOT invent content.
        parts.push({
          type: "text",
          text: `\n--- DOCUMENT ${pdfIdx}${f.docType ? ` (docType=${f.docType})` : ""} ---\n[A PDF with ${result.numPages} page(s) was uploaded but no machine-readable text could be extracted (likely a scanned image). Treat it as NO usable invoice text — set document_analysis.invoice_valid to null and extracted_fields to nulls.]`,
        });
      }
    }
  }

  return { parts, inspection };
}

/**
 * Single multimodal call: system instruction + user prompt + inline files.
 * Returns the raw text (valid JSON via response_format) AND the evidence
 * inspection report (so the orchestrator can attach provenance).
 */
export async function analyzeMultimodal(
  systemInstruction: string,
  userPrompt: string,
  files: GeminiInlineFile[]
): Promise<{ raw: string; inspection: EvidenceInspection }> {
  const openai = getClient();
  const { parts, inspection } = await buildContentParts(userPrompt, files);

  try {
    const response = await openai.chat.completions.create({
      model: FLASH_MODEL,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: parts },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
    });

    return {
      raw: response.choices[0]?.message?.content ?? "{}",
      inspection,
    };
  } catch (err) {
    throw new Error(
      `Chat completion failed (model=${FLASH_MODEL}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
