import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/card";
import { AnalyticsChart } from "@/components/analytics-chart";
import {
  avoidedCostPerCase,
  COST_SAVING_RECOMMENDATIONS,
  projectedMonthlySaving,
} from "@/lib/cost";
import { RecommendationBadge } from "@/components/recommendation-badge";

export const dynamic = "force-dynamic";

const FALLBACK_PRODUCT_VALUE_AED = 2500;
const MONTHLY_VOLUME_MULTIPLIER = 4;

export default async function AnalyticsPage() {
  const [totalCases, decisionGroups, analyses] = await Promise.all([
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
  const decisionCounts: Record<string, number> = {};
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
  for (const d of decisionGroups) decisionCounts[d.decision] = d._count._all;

  const conservativeCount = Object.entries(recommendationCounts)
    .filter(([k]) => COST_SAVING_RECOMMENDATIONS.has(k))
    .reduce((sum, [, n]) => sum + n, 0);

  const projectedMonthlyAed = projectedMonthlySaving(
    conservativeCount * MONTHLY_VOLUME_MULTIPLIER,
    FALLBACK_PRODUCT_VALUE_AED
  );
  const avgLatency = analyses.length ? Math.round(totalLatencyMs / analyses.length) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Business impact and AI pipeline health on the current dataset.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total cases" value={totalCases.toString()} />
        <Stat label="Analyses run" value={analyses.length.toString()} />
        <Stat label="Estimated avoided" value={`AED ${Math.round(totalAvoidedAed).toLocaleString()}`} />
        <Stat label="Avg analysis latency" value={`${avgLatency} ms`} />
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">AI recommendations</h2>
        <AnalyticsChart counts={recommendationCounts} />
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Manager decisions</h2>
          {Object.keys(decisionCounts).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No decisions recorded yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(decisionCounts).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between">
                  <RecommendationBadge value={k} size="sm" />
                  <span className="tabular-nums font-medium">{v}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Projected monthly saving</h2>
          <p className="text-3xl font-semibold tabular-nums mt-2">
            AED {Math.round(projectedMonthlyAed).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Extrapolation: {conservativeCount} conservative recommendations × {MONTHLY_VOLUME_MULTIPLIER} (assumed monthly throughput multiplier) × avoided cost per case
            (AED {Math.round(avoidedCostPerCase(FALLBACK_PRODUCT_VALUE_AED)).toLocaleString()} at avg product value AED {FALLBACK_PRODUCT_VALUE_AED}).
          </p>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
    </Card>
  );
}
