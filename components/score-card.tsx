import { Card } from "@/components/ui/card";
import { RecommendationBadge } from "@/components/recommendation-badge";
import { cn } from "@/lib/utils";
import { Target, AlertTriangle } from "lucide-react";

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreRingColor(score: number): string {
  if (score >= 75) return "stroke-emerald-500";
  if (score >= 50) return "stroke-amber-500";
  return "stroke-red-500";
}

function scoreLabel(score: number): string {
  if (score >= 86) return "Strong — Replacement likely warranted";
  if (score >= 71) return "Good — Escalate for manager approval";
  if (score >= 51) return "Moderate — Further investigation needed";
  if (score >= 31) return "Weak — Request more evidence";
  return "Insufficient — Reject or seek strong evidence";
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  return (
    <div className="relative size-28 shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn("transition-all duration-700", scoreRingColor(score))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-bold tabular-nums", scoreColor(score))}>
          {score}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">/100</span>
      </div>
    </div>
  );
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
    <Card className="p-5 bg-white shadow-sm border-slate-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* Score Ring */}
        <ScoreRing score={score} />

        {/* Text */}
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Target className="size-3" />
              Replacement Validity Score (RVS)
            </p>
            <p className={cn("text-sm font-medium mt-0.5", scoreColor(score))}>
              {scoreLabel(score)}
            </p>
          </div>

          {rvsRecomputed !== undefined && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>Model score: <strong className="text-slate-800">{score}</strong></span>
              <span>•</span>
              <span>Computed (weighted formula): <strong className="text-slate-800">{rvsRecomputed}</strong></span>
              {drift > 20 ? (
                <span className="text-amber-600 font-semibold">⚠ drift: {drift}</span>
              ) : (
                <span className="text-emerald-600 font-medium">✓ drift: {drift}</span>
              )}
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              AI Recommendation
            </p>
            <RecommendationBadge value={recommendation} size="lg" />
          </div>
        </div>
      </div>

      {thresholdWarning && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <strong>Threshold check (§12.2):</strong> {thresholdWarning}
          </div>
        </div>
      )}
    </Card>
  );
}
