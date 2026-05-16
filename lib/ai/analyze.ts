// lib/ai/analyze.ts
// Orchestrator: load case → retrieve policy → fetch files → call Gemini →
// validate with Zod (one repair retry) → compute RVS → persist AiAnalysis.
// Brief §6.

import { prisma } from "@/lib/db/prisma";
import { retrieveTopK, type RetrievedChunk } from "./retrieve";
import { analyzeMultimodal, FLASH_MODEL, type GeminiInlineFile } from "./gemini";
import { SYSTEM_PROMPT, buildUserPrompt, REPAIR_INSTRUCTION } from "./prompts";
import { aiAnalysisSchema, type AiAnalysisJson } from "./schema";
import { computeRVS, rvsDelta } from "./score";
import { productContextBlock } from "@/lib/catalogue";

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
};

async function fetchBlobAsBase64(url: string): Promise<GeminiInlineFile> {
  // Handle base64 data URIs stored directly in DB (when Vercel Blob is not configured)
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], base64: match[2] };
    }
    throw new Error("invalid data URI format");
  }

  // Standard HTTP fetch for Vercel Blob URLs
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch blob ${url}: ${res.status} ${res.statusText}`);
  }
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  return { mimeType, base64: buf.toString("base64") };
}

function safeParseJson(raw: string): unknown | null {
  // Some models still wrap JSON in ```json fences despite responseMimeType.
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
    eligibleDocs.map((d) => fetchBlobAsBase64(d.blobUrl))
  );

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
  });

  // 3. Call Gemini (with one repair retry on invalid JSON).
  let raw = await analyzeMultimodal(SYSTEM_PROMPT, userPrompt, files);
  let parsed = safeParseJson(raw);
  let validated = parsed ? aiAnalysisSchema.safeParse(parsed) : null;

  if (!validated || !validated.success) {
    raw = await analyzeMultimodal(
      SYSTEM_PROMPT,
      `${userPrompt}\n\n${REPAIR_INSTRUCTION}`,
      files
    );
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
      throw new Error(`gemini returned invalid output after repair: ${issues}`);
    }
  }

  const analysis = validated.data;
  const rvsRecomputed = computeRVS(analysis);
  const latencyMs = Date.now() - t0;

  const retrievedChunks = chunks.map((c) => ({
    id: c.id,
    policyName: c.policyName,
    sectionRef: c.sectionRef,
    score: c.score,
  }));

  // 4. Persist (upsert keyed on caseId for repeat analyses).
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
  };
}
