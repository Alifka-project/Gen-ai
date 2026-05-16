import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { computeRVS } from "@/lib/ai/score";
import { aiAnalysisSchema } from "@/lib/ai/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [analyses, policyChunks] = await Promise.all([
      prisma.aiAnalysis.findMany({
        include: {
          case: {
            select: {
              id: true,
              customerName: true,
              productModel: true,
              serialNumber: true,
              complaintText: true,
              requestedAction: true,
              createdAt: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.policyChunk.count(),
    ]);

    if (analyses.length === 0) {
      return NextResponse.json({
        totalAnalyses: 0,
        avgLatencyMs: 0,
        avgScore: 0,
        minScore: 0,
        maxScore: 0,
        recommendationCounts: {},
        scoreDistribution: [],
        caseDetails: [],
        policyChunkCount: policyChunks,
        modelsUsed: [],
        avgRetrievedChunks: 0,
        avgChunkSimilarity: 0,
        rvsAccuracy: 0,
      });
    }

    let totalLatency = 0;
    let totalScore = 0;
    let minScore = 100;
    let maxScore = 0;
    const recommendationCounts: Record<string, number> = {};
    const modelsUsedSet = new Set<string>();
    let totalChunksRetrieved = 0;
    let totalChunkSimilarity = 0;
    let chunkCount = 0;
    let rvsMatchCount = 0;

    // Score distribution buckets: 0-20, 21-40, 41-60, 61-80, 81-100
    const scoreDistributionMap: Record<string, number> = {
      "0–20": 0,
      "21–40": 0,
      "41–60": 0,
      "61–80": 0,
      "81–100": 0,
    };

    const caseDetails = analyses.map((a) => {
      totalLatency += a.latencyMs;
      totalScore += a.replacementValidityScore;
      minScore = Math.min(minScore, a.replacementValidityScore);
      maxScore = Math.max(maxScore, a.replacementValidityScore);
      recommendationCounts[a.recommendation] =
        (recommendationCounts[a.recommendation] ?? 0) + 1;
      modelsUsedSet.add(a.modelUsed);

      // Score distribution
      if (a.replacementValidityScore <= 20) scoreDistributionMap["0–20"]++;
      else if (a.replacementValidityScore <= 40) scoreDistributionMap["21–40"]++;
      else if (a.replacementValidityScore <= 60) scoreDistributionMap["41–60"]++;
      else if (a.replacementValidityScore <= 80) scoreDistributionMap["61–80"]++;
      else scoreDistributionMap["81–100"]++;

      // Retrieved chunks stats
      const chunks = (a.retrievedChunks as Array<{
        id: string;
        policyName: string;
        sectionRef: string;
        score: number;
      }> | null) ?? [];
      totalChunksRetrieved += chunks.length;
      for (const c of chunks) {
        totalChunkSimilarity += c.score;
        chunkCount++;
      }

      // RVS drift check
      const parsed = aiAnalysisSchema.safeParse(a.explanationJson);
      const computed = parsed.success ? computeRVS(parsed.data) : null;
      const drift = computed !== null ? Math.abs(computed - a.replacementValidityScore) : null;
      if (drift !== null && drift <= 20) rvsMatchCount++;

      // Factor scores from explanationJson
      let clarityScore: number | null = null;
      let evidenceQuality: number | null = null;
      let visibleDamage: boolean | null = null;
      let damageType: string | null = null;
      let complaintCategory: string | null = null;
      let severity: string | null = null;
      let managerSummary: string | null = null;
      let verifiedFactsCount = 0;
      let uncertaintiesCount = 0;
      let contradictionsCount = 0;
      let invoiceValid: boolean | null = null;
      let warrantyStatus: string | null = null;

      if (parsed.success) {
        const d = parsed.data;
        clarityScore = d.complaint_analysis.clarity_score;
        evidenceQuality = d.visual_analysis.evidence_quality_score;
        visibleDamage = d.visual_analysis.visible_damage;
        damageType = d.visual_analysis.damage_type;
        complaintCategory = d.complaint_analysis.category;
        severity = d.complaint_analysis.severity;
        managerSummary = d.manager_summary;
        verifiedFactsCount = d.verified_facts.length;
        uncertaintiesCount = d.uncertainties.length;
        contradictionsCount = d.contradictions.length;
        invoiceValid = d.document_analysis.invoice_valid;
        warrantyStatus = d.document_analysis.warranty_status;
      }

      return {
        caseId: a.case?.id ?? a.caseId,
        customerName: a.case?.customerName ?? "Unknown",
        productModel: a.case?.productModel ?? "Unknown",
        serialNumber: a.case?.serialNumber ?? null,
        complaintText: (a.case?.complaintText ?? "").slice(0, 120),
        requestedAction: a.case?.requestedAction ?? "Unknown",
        status: a.case?.status ?? "unknown",
        latencyMs: a.latencyMs,
        score: a.replacementValidityScore,
        recommendation: a.recommendation,
        modelUsed: a.modelUsed,
        retrievedChunks: chunks,
        createdAt: a.createdAt.toISOString(),
        rvsComputed: computed,
        rvsDrift: drift,
        clarityScore,
        evidenceQuality,
        visibleDamage,
        damageType,
        complaintCategory,
        severity,
        managerSummary,
        verifiedFactsCount,
        uncertaintiesCount,
        contradictionsCount,
        invoiceValid,
        warrantyStatus,
      };
    });

    const avgLatencyMs = Math.round(totalLatency / analyses.length);
    const avgScore = Math.round(totalScore / analyses.length);
    const avgRetrievedChunks = analyses.length
      ? Math.round((totalChunksRetrieved / analyses.length) * 10) / 10
      : 0;
    const avgChunkSimilarity =
      chunkCount > 0
        ? Math.round((totalChunkSimilarity / chunkCount) * 1000) / 1000
        : 0;
    const rvsAccuracy =
      analyses.length > 0
        ? Math.round((rvsMatchCount / analyses.length) * 100)
        : 0;

    const scoreDistribution = Object.entries(scoreDistributionMap).map(
      ([range, count]) => ({ range, count })
    );

    return NextResponse.json({
      totalAnalyses: analyses.length,
      avgLatencyMs,
      avgScore,
      minScore,
      maxScore,
      recommendationCounts,
      scoreDistribution,
      caseDetails,
      policyChunkCount: policyChunks,
      modelsUsed: Array.from(modelsUsedSet),
      avgRetrievedChunks,
      avgChunkSimilarity,
      rvsAccuracy,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
