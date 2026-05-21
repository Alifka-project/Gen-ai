// lib/ai/pdf-extract.ts
// Extract text from a PDF buffer using unpdf. Used to feed invoice/document
// text into the GPT-4o prompt instead of stubbing PDFs out (which previously
// caused the model to hallucinate document_analysis fields).

import { extractText, getDocumentProxy } from "unpdf";

export type PdfExtractResult = {
  text: string;
  numPages: number;
  /** Per-page text. Useful for showing the manager what was read. */
  pages: string[];
  /** True if extraction produced essentially no text (likely a scanned PDF). */
  isLikelyScanned: boolean;
};

/**
 * Pure extraction — never throws on a malformed PDF, returns an empty result
 * so the caller can decide what to do.
 */
export async function extractPdfText(
  bytes: Uint8Array
): Promise<PdfExtractResult> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const numPages = pdf.numPages;

    // unpdf overloads: mergePages:false returns text:string[]; mergePages:true returns text:string.
    const perPageResult = await extractText(pdf, { mergePages: false });
    const pages: string[] = perPageResult.text;
    const text = pages.join("\n\n");

    const cleaned = text.replace(/\s+/g, " ").trim();
    const isLikelyScanned = cleaned.length < 50 && numPages > 0;

    return { text, numPages, pages, isLikelyScanned };
  } catch (err) {
    console.warn(
      "[pdf-extract] failed:",
      err instanceof Error ? err.message : err
    );
    return { text: "", numPages: 0, pages: [], isLikelyScanned: true };
  }
}
