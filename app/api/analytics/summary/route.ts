import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  avoidedCostPerCase,
  COST_SAVING_RECOMMENDATIONS,
  projectedMonthlySaving,
  resolveProductValueAed,
} from "@/lib/cost";
import { DEFAULT_PRODUCT_VALUE_AED } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

const FALLBACK_PRODUCT_VALUE_AED = DEFAULT_PRODUCT_VALUE_AED;

export async function GET() {
  const [totalCases, decisions, analyses] = await Promise.all([
    prisma.case.count(),
    prisma.managerDecision.groupBy({
      by: ["decision"],
      _count: { _all: true },
    }),
    prisma.aiAnalysis.findMany({
      select: {
        recommendation: true,
        explanationJson: true,
        latencyMs: true,
        case: { select: { productModel: true } },
      },
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
      const value = resolveProductValueAed(
        typeof productValue === "number" ? productValue : null,
        a.case?.productModel
      );
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
