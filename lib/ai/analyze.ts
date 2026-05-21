// lib/ai/analyze.ts
// Orchestrator: load case → retrieve policy → fetch files → call GPT-4o →
// validate with Zod (one repair retry) → APPLY EVIDENCE GUARDS → compute RVS →
// persist AiAnalysis (with provenance block). Brief §6.

import { prisma } from "@/lib/db/prisma";
import { retrieveTopK, type RetrievedChunk } from "./retrieve";
import {
  analyzeMultimodal,
  FLASH_MODEL,
  type GeminiInlineFile,
  type EvidenceInspection,
} from "./gemini";
import { SYSTEM_PROMPT, buildUserPrompt, REPAIR_INSTRUCTION } from "./prompts";
import { aiAnalysisSchema, type AiAnalysisJson } from "./schema";
import { computeRVS, rvsDelta } from "./score";
import { productContextBlock } from "@/lib/catalogue";
import { applyEvidenceGuards, type GuardEvent } from "./evidence-guards";

export type AnalyzeResult = {
  analysis: AiAnalysisJson;
  retrievedChunks: Array<
    Pick<RetrievedChunk, "id" | "policyName" | "sectionRef" | "score">
  >;
  rvsRecomputed: number;
  rvsDelta: number;
  latencyMs: number;
  modelUsed: string;
  rawOutput: string;
  evidenceInspection: EvidenceInspection;
  guardEvents: GuardEvent[];
};

async function fetchBlobAsBase64(url: string): Promise<{
  mimeType: string;
  base64: string;
}> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) return { mimeType: match[1], base64: match[2] };
    throw new Error("invalid data URI format");
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch blob ${url}: ${res.status} ${res.statusText}`);
  }
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  return { mimeType, base64: buf.toString("base64") };
}

function safeParseJson(raw: string): unknown | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function analyzeCase(caseId: string): Promise<AnalyzeResult> {
  const t0 = Date.now();

  const caseRow = await prisma.case.findUnique({
    where: { id: caseId },
    include: { documents: true },
  });
  if (!caseRow) throw new Error(`case not found: ${caseId}`);

  await prisma.case.update({
    where: { id: caseId },
    data: { status: "analyzing" },
  });

  // 1. Retrieve relevant policy via RAG.
  const retrievalQuery = `Product: ${caseRow.productModel}. Complaint: ${caseRow.complaintText}. Requested action: ${caseRow.requestedAction}.`;
  const chunks = await retrieveTopK(retrievalQuery, 5);

  // 2. Pull each Document file from Vercel Blob as base64 (images + PDFs only).
  const eligibleDocs = caseRow.documents.filter(
    (d) =>
      !!d.blobUrl &&
      (d.mimeType.startsWith("image/") || d.mimeType === "application/pdf")
  );
  const files: GeminiInlineFile[] = await Promise.all(
    eligibleDocs.map(async (d) => ({
      ...(await fetchBlobAsBase64(d.blobUrl)),
      docType: d.docType,
    }))
  );

  // Pre-count evidence so the prompt can warn the model up-front.
  const preImageCount = files.filter((f) => f.mimeType.startsWith("image/")).length;
  const prePdfCount = files.filter((f) => f.mimeType === "application/pdf").length;

  const userPrompt = buildUserPrompt({
    caseMetadata: {
      caseId: caseRow.id,
      customerName: caseRow.customerName,
      productModel: caseRow.productModel,
      serialNumber: caseRow.serialNumber,
      createdAt: caseRow.createdAt.toISOString(),
      documentCount: eligibleDocs.length,
      documentTypes: eligibleDocs.map((d) => d.docType),
    },
    complaintText: caseRow.complaintText,
    requestedAction: caseRow.requestedAction,
    retrievedPolicy: chunks.map((c) => ({
      policyName: c.policyName,
      sectionRef: c.sectionRef,
      chunkText: c.chunkText,
    })),
    productContext: productContextBlock(caseRow.productModel),
    evidenceCounts: { imageCount: preImageCount, pdfCount: prePdfCount },
  });

  // 3. Call GPT-4o (with one repair retry on invalid JSON).
  let modelCall = await analyzeMultimodal(SYSTEM_PROMPT, userPrompt, files);
  let raw = modelCall.raw;
  let inspection = modelCall.inspection;
  let parsed = safeParseJson(raw);
  let validated = parsed ? aiAnalysisSchema.safeParse(parsed) : null;

  if (!validated || !validated.success) {
    modelCall = await analyzeMultimodal(
      SYSTEM_PROMPT,
      `${userPrompt}\n\n${REPAIR_INSTRUCTION}`,
      files
    );
    raw = modelCall.raw;
    inspection = modelCall.inspection;
    parsed = safeParseJson(raw);
    validated = parsed ? aiAnalysisSchema.safeParse(parsed) : null;
    if (!validated || !validated.success) {
      await prisma.case.update({
        where: { id: caseId },
        data: { status: "new" },
      });
      const issues =
        validated && !validated.success
          ? JSON.stringify(validated.error.issues)
          : "unparseable";
      throw new Error(`AI returned invalid output after repair: ${issues}`);
    }
  }

  // 4. APPLY EVIDENCE GUARDS — the critical anti-hallucination layer.
  const { cleaned, events: guardEvents } = applyEvidenceGuards(validated.data, {
    imageCount: inspection.imageCount,
    pdfCount: inspection.pdfCount,
    pdfCharsExtracted: inspection.pdfCharsExtracted,
  });

  // 5. Stamp provenance onto the analysis.
  const analysis: AiAnalysisJson = {
    ...cleaned,
    evidence_inspected: {
      imageCount: inspection.imageCount,
      pdfCount: inspection.pdfCount,
      pdfPagesRead: inspection.pdfPagesRead,
      pdfCharsExtracted: inspection.pdfCharsExtracted,
      scannedPdfCount: inspection.scannedPdfCount,
      policyChunksRetrieved: chunks.length,
      guardEvents,
    },
  };

  const rvsRecomputed = computeRVS(analysis);
  const latencyMs = Date.now() - t0;

  const retrievedChunks = chunks.map((c) => ({
    id: c.id,
    policyName: c.policyName,
    sectionRef: c.sectionRef,
    score: c.score,
  }));

  // 6. Persist.
  await prisma.aiAnalysis.upsert({
    where: { caseId },
    update: {
      replacementValidityScore: analysis.replacement_validity_score,
      recommendation: analysis.recommended_action,
      retrievedChunks: retrievedChunks as unknown as object,
      explanationJson: analysis as unknown as object,
      rawOutput: raw,
      modelUsed: FLASH_MODEL,
      latencyMs,
    },
    create: {
      caseId,
      replacementValidityScore: analysis.replacement_validity_score,
      recommendation: analysis.recommended_action,
      retrievedChunks: retrievedChunks as unknown as object,
      explanationJson: analysis as unknown as object,
      rawOutput: raw,
      modelUsed: FLASH_MODEL,
      latencyMs,
    },
  });

  await prisma.case.update({
    where: { id: caseId },
    data: { status: "analyzed" },
  });

  return {
    analysis,
    retrievedChunks,
    rvsRecomputed,
    rvsDelta: rvsDelta(analysis),
    latencyMs,
    modelUsed: FLASH_MODEL,
    rawOutput: raw,
    evidenceInspection: inspection,
    guardEvents,
  };
}
