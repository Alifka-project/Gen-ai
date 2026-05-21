// lib/ai/analyze.ts
// Multi-agent, multi-model orchestrator.
//
// Pipeline per case:
//   1. Load case + documents from DB.
//   2. RAG: embed the query, retrieve top-5 policy chunks (pgvector).
//   3. Fetch each Document file from Blob as base64.
//   4. Build the master user prompt (same for both analyzers).
//   5. Run two ANALYZERS in parallel:
//        - Primary:   GPT-4o (multimodal, JSON mode)
//        - Secondary: Claude Sonnet 4.5 (multimodal, native PDF input)
//      Both validate against the same Zod schema (one repair retry each).
//   6. Run the CRITIC (GPT-4o, given primary's output) for a cross-model
//      independent verdict — disabled when MULTI_MODEL_ENABLED is "false".
//   7. Compute CONSENSUS between primary + secondary. When models disagree,
//      the orchestrator can promote the recommendation to a more
//      conservative action ("escalate_manager") per the safety policy.
//   8. Apply EVIDENCE GUARDS to the primary (null/zero fields with no
//      underlying evidence).
//   9. Stamp provenance + multi_model metadata onto the analysis, persist.
//
// Set MULTI_MODEL_ENABLED=false in env to skip the secondary analyzer + critic
// (saves 1 Claude + 1 GPT call per analysis — useful when only one provider
// is available).

import { prisma } from "@/lib/db/prisma";
import { retrieveTopK, type RetrievedChunk } from "./retrieve";
import {
  analyzeMultimodal,
  FLASH_MODEL,
  type GeminiInlineFile,
  type EvidenceInspection,
} from "./gemini";
import { analyzeWithClaude } from "./claude";
import { SYSTEM_PROMPT, buildUserPrompt, REPAIR_INSTRUCTION } from "./prompts";
import { aiAnalysisSchema, type AiAnalysisJson } from "./schema";
import { computeRVS, rvsDelta } from "./score";
import { productContextBlock } from "@/lib/catalogue";
import { applyEvidenceGuards, type GuardEvent } from "./evidence-guards";
import { runCritic, type CriticVerdict } from "./critic";
import { computeConsensus, type ConsensusReport } from "./consensus";
import { AGENT_MODELS } from "./clients";
import { verifyIdentity } from "./identity-verifier";
import { extractExif, type ExifData } from "./exif-extract";

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
  multiModel?: {
    primaryModel: string;
    secondaryModel: string;
    secondaryAnalysis: AiAnalysisJson | null;
    secondaryRawError?: string;
    consensus: ConsensusReport | null;
    critic: CriticVerdict | null;
  };
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

/** Run one analyzer (with one repair retry on invalid JSON). Returns null
 *  if both attempts fail — the orchestrator records the failure rather than
 *  crashing the whole pipeline. */
async function runAnalyzer(
  name: "primary" | "secondary",
  fn: (sys: string, user: string, files: GeminiInlineFile[]) => Promise<{
    raw: string;
    inspection: EvidenceInspection;
  }>,
  systemPrompt: string,
  userPrompt: string,
  files: GeminiInlineFile[]
): Promise<{
  analysis: AiAnalysisJson | null;
  raw: string;
  inspection: EvidenceInspection;
  error?: string;
}> {
  let call = await fn(systemPrompt, userPrompt, files);
  let parsed = safeParseJson(call.raw);
  let validated = parsed ? aiAnalysisSchema.safeParse(parsed) : null;

  if (!validated || !validated.success) {
    call = await fn(systemPrompt, `${userPrompt}\n\n${REPAIR_INSTRUCTION}`, files);
    parsed = safeParseJson(call.raw);
    validated = parsed ? aiAnalysisSchema.safeParse(parsed) : null;
  }

  if (!validated || !validated.success) {
    const issues =
      validated && !validated.success
        ? JSON.stringify(validated.error.issues).slice(0, 400)
        : "unparseable JSON";
    return {
      analysis: null,
      raw: call.raw,
      inspection: call.inspection,
      error: `[${name}] ${issues}`,
    };
  }

  return { analysis: validated.data, raw: call.raw, inspection: call.inspection };
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

  // 1. RAG.
  const retrievalQuery = `Product: ${caseRow.productModel}. Complaint: ${caseRow.complaintText}. Requested action: ${caseRow.requestedAction}.`;
  const chunks = await retrieveTopK(retrievalQuery, 5);

  // 2. Fetch evidence files.
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

  const preImageCount = files.filter((f) => f.mimeType.startsWith("image/")).length;
  const prePdfCount = files.filter((f) => f.mimeType === "application/pdf").length;

  // Extract EXIF from the first image (used by the identity verifier).
  let firstImageExif: ExifData | null = null;
  const firstImage = files.find((f) => f.mimeType.startsWith("image/"));
  if (firstImage) {
    try {
      const bytes = Uint8Array.from(Buffer.from(firstImage.base64, "base64"));
      firstImageExif = extractExif(bytes, firstImage.mimeType);
    } catch {
      firstImageExif = null;
    }
  }

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

  // 3. Run primary (GPT-4o) and secondary (Claude) ANALYZERS in parallel.
  const multiModelEnabled = (process.env.MULTI_MODEL_ENABLED ?? "true") !== "false";

  const primaryPromise = runAnalyzer(
    "primary",
    analyzeMultimodal,
    SYSTEM_PROMPT,
    userPrompt,
    files
  );
  const secondaryPromise: Promise<
    Awaited<ReturnType<typeof runAnalyzer>> | null
  > = multiModelEnabled
    ? runAnalyzer("secondary", analyzeWithClaude, SYSTEM_PROMPT, userPrompt, files).catch(
        (e) => ({
          analysis: null,
          raw: "",
          inspection: {
            imageCount: 0,
            pdfCount: 0,
            pdfPagesRead: 0,
            pdfCharsExtracted: 0,
            scannedPdfCount: 0,
          },
          error: `[secondary-throw] ${e instanceof Error ? e.message : String(e)}`,
        })
      )
    : Promise.resolve(null);

  const [primaryResult, secondaryResult] = await Promise.all([
    primaryPromise,
    secondaryPromise,
  ]);

  if (!primaryResult.analysis) {
    await prisma.case.update({
      where: { id: caseId },
      data: { status: "new" },
    });
    throw new Error(`Primary analyzer failed: ${primaryResult.error}`);
  }

  const primaryAnalysis = primaryResult.analysis;
  const inspection = primaryResult.inspection;

  // 4. Apply evidence guards on the PRIMARY.
  const { cleaned, events: guardEvents } = applyEvidenceGuards(primaryAnalysis, {
    imageCount: inspection.imageCount,
    pdfCount: inspection.pdfCount,
    pdfCharsExtracted: inspection.pdfCharsExtracted,
  });

  // 5. Cross-model consensus + critic (best-effort; never blocks the primary).
  let consensus: ConsensusReport | null = null;
  let cleanedSecondary: AiAnalysisJson | null = null;
  if (secondaryResult?.analysis) {
    const { cleaned: c2 } = applyEvidenceGuards(secondaryResult.analysis, {
      imageCount: inspection.imageCount,
      pdfCount: inspection.pdfCount,
      pdfCharsExtracted: inspection.pdfCharsExtracted,
    });
    cleanedSecondary = c2;
    consensus = computeConsensus(cleaned, c2);
  }

  // 5b. Deterministic identity verification — does the photographed product
  //     actually match the item the customer purchased?
  const identityVerification = verifyIdentity({
    analysis: cleaned,
    formSerial: caseRow.serialNumber,
    formCustomerName: caseRow.customerName,
    productModel: caseRow.productModel,
    exif: firstImageExif,
  });

  let criticVerdict: CriticVerdict | null = null;
  if (multiModelEnabled) {
    try {
      criticVerdict = await runCritic({
        productModel: caseRow.productModel,
        complaintText: caseRow.complaintText,
        evidenceSummary: {
          imageCount: inspection.imageCount,
          pdfCount: inspection.pdfCount,
          pdfCharsExtracted: inspection.pdfCharsExtracted,
          policyChunksRetrieved: chunks.length,
        },
        primaryAnalysis: cleaned,
        primaryModel: AGENT_MODELS.primaryAnalyzer,
      });
    } catch (e) {
      console.warn(
        "[analyze] critic failed (continuing):",
        e instanceof Error ? e.message : e
      );
    }
  }

  // 6. Stamp metadata. The TOP-LEVEL recommendation stays as the primary's,
  //    unless consensus is low — then we promote to the safer consensus.resolution.
  let finalRecommendation = cleaned.recommended_action;
  let consensusOverride: GuardEvent | null = null;
  if (
    consensus &&
    consensus.level === "low" &&
    consensus.resolution !== cleaned.recommended_action
  ) {
    consensusOverride = {
      field: "recommended_action",
      original: cleaned.recommended_action,
      enforced: consensus.resolution,
      reason: `multi-model consensus is low (${consensus.matchPct}% field agreement, score delta ${consensus.scoreDelta}); promoting to safer action`,
    };
    finalRecommendation = consensus.resolution as typeof cleaned.recommended_action;
  }

  const analysis: AiAnalysisJson = {
    ...cleaned,
    recommended_action: finalRecommendation,
    evidence_inspected: {
      imageCount: inspection.imageCount,
      pdfCount: inspection.pdfCount,
      pdfPagesRead: inspection.pdfPagesRead,
      pdfCharsExtracted: inspection.pdfCharsExtracted,
      scannedPdfCount: inspection.scannedPdfCount,
      policyChunksRetrieved: chunks.length,
      guardEvents: consensusOverride ? [...guardEvents, consensusOverride] : guardEvents,
    },
    identity_verification: identityVerification,
    multi_model:
      cleanedSecondary && consensus
        ? {
            primary_model: AGENT_MODELS.primaryAnalyzer,
            secondary_model: AGENT_MODELS.secondaryAnalyzer,
            secondary_recommendation: cleanedSecondary.recommended_action,
            secondary_score: cleanedSecondary.replacement_validity_score,
            secondary_summary: cleanedSecondary.manager_summary,
            consensus: {
              actionsMatch: consensus.actionsMatch,
              scoreDelta: consensus.scoreDelta,
              level: consensus.level,
              resolution: consensus.resolution,
              summary: consensus.summary,
              matchPct: consensus.matchPct,
              byField: consensus.byField,
            },
            critic: criticVerdict ?? undefined,
          }
        : undefined,
  };

  const rvsRecomputed = computeRVS(analysis);
  const latencyMs = Date.now() - t0;

  const retrievedChunks = chunks.map((c) => ({
    id: c.id,
    policyName: c.policyName,
    sectionRef: c.sectionRef,
    score: c.score,
  }));

  // Persist. modelUsed records the multi-model ensemble identity, not just GPT.
  const modelUsed =
    cleanedSecondary && consensus
      ? `ensemble:${AGENT_MODELS.primaryAnalyzer}+${AGENT_MODELS.secondaryAnalyzer}${
          criticVerdict ? `+critic:${criticVerdict.model_used}` : ""
        }`
      : AGENT_MODELS.primaryAnalyzer;

  await prisma.aiAnalysis.upsert({
    where: { caseId },
    update: {
      replacementValidityScore: analysis.replacement_validity_score,
      recommendation: analysis.recommended_action,
      retrievedChunks: retrievedChunks as unknown as object,
      explanationJson: analysis as unknown as object,
      rawOutput: primaryResult.raw,
      modelUsed,
      latencyMs,
    },
    create: {
      caseId,
      replacementValidityScore: analysis.replacement_validity_score,
      recommendation: analysis.recommended_action,
      retrievedChunks: retrievedChunks as unknown as object,
      explanationJson: analysis as unknown as object,
      rawOutput: primaryResult.raw,
      modelUsed,
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
    modelUsed,
    rawOutput: primaryResult.raw,
    evidenceInspection: inspection,
    guardEvents: analysis.evidence_inspected?.guardEvents ?? guardEvents,
    multiModel: {
      primaryModel: AGENT_MODELS.primaryAnalyzer,
      secondaryModel: AGENT_MODELS.secondaryAnalyzer,
      secondaryAnalysis: cleanedSecondary,
      secondaryRawError: secondaryResult?.error,
      consensus,
      critic: criticVerdict,
    },
  };
}

export { FLASH_MODEL };
