import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  avoidedCostPerCase,
  COST_SAVING_RECOMMENDATIONS,
  projectedMonthlySaving,
} from "@/lib/cost";

export const dynamic = "force-dynamic";

const FALLBACK_PRODUCT_VALUE_AED = 2500;

export async function GET() {
  const [totalCases, decisions, analyses] = await Promise.all([
    prisma.case.count(),
    prisma.managerDecision.groupBy({
      by: ["decision"],
      _count: { _all: true },
    }),
    prisma.aiAnalysis.findMany({
      select: { recommendation: true, explanationJson: true, latencyMs: true },
    }),
  ]);

  const recommendationCounts: Record<string, number> = {};
  let totalAvoidedAed = 0;
  let totalLatencyMs = 0;

  for (const a of analyses) {
    recommendationCounts[a.recommendation] =
      (recommendationCounts[a.recommendation] ?? 0) + 1;
    totalLatencyMs += a.latencyMs;
    if (COST_SAVING_RECOMMENDATIONS.has(a.recommendation)) {
      const productValue =
        ((a.explanationJson as Record<string, unknown> | null)
          ?.document_analysis as Record<string, unknown> | undefined)
          ?.product_value_aed;
      const value =
        typeof productValue === "number"
          ? productValue
          : FALLBACK_PRODUCT_VALUE_AED;
      totalAvoidedAed += avoidedCostPerCase(value);
    }
  }

  const decisionCounts: Record<string, number> = {};
  for (const d of decisions) {
    decisionCounts[d.decision] = d._count._all;
  }

  const avgLatencyMs = analyses.length
    ? Math.round(totalLatencyMs / analyses.length)
    : 0;

  // Extrapolate monthly saving assuming 4x throughput vs MVP sample.
  const projectedMonthlyAed = projectedMonthlySaving(
    Object.entries(recommendationCounts)
      .filter(([k]) => COST_SAVING_RECOMMENDATIONS.has(k))
      .reduce((sum, [, n]) => sum + n, 0) * 4,
    FALLBACK_PRODUCT_VALUE_AED
  );

  return NextResponse.json({
    totalCases,
    analysesCount: analyses.length,
    recommendationCounts,
    decisionCounts,
    estimatedAvoidedAed: Math.round(totalAvoidedAed),
    projectedMonthlyAed: Math.round(projectedMonthlyAed),
    assumedAvgProductValueAed: FALLBACK_PRODUCT_VALUE_AED,
    avgLatencyMs,
  });
}
