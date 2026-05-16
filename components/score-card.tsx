import { Card } from "@/components/ui/card";
import { RecommendationBadge } from "@/components/recommendation-badge";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Strong evidence";
  if (score >= 50) return "Mixed evidence";
  if (score >= 25) return "Weak evidence";
  return "Insufficient evidence";
}

export function ScoreCard({
  score,
  recommendation,
  rvsRecomputed,
  thresholdWarning,
}: {
  score: number;
  recommendation: string;
  rvsRecomputed?: number;
  thresholdWarning?: string | null;
}) {
  const drift = rvsRecomputed !== undefined ? Math.abs(rvsRecomputed - score) : 0;
  return (
    <Card className="p-6 space-y-3">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Replacement Validity Score (RVS)
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className={cn("text-5xl font-semibold tabular-nums", scoreColor(score))}>
              {score}
            </span>
            <span className="text-muted-foreground text-sm">/ 100</span>
            <span className="text-sm text-muted-foreground">— {scoreLabel(score)}</span>
          </div>
          {rvsRecomputed !== undefined && drift > 20 ? (
            <p className="text-xs text-amber-700 mt-1">
              ⚠ Model score and recomputed weighted score differ by {drift} (sanity check threshold: 20).
              Recomputed: {rvsRecomputed}.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-start md:items-end gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            AI Recommendation
          </p>
          <RecommendationBadge value={recommendation} size="lg" />
        </div>
      </div>
      {thresholdWarning ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Threshold sanity check (proposal §12.2):</strong> {thresholdWarning}
        </div>
      ) : null}
    </Card>
  );
}
