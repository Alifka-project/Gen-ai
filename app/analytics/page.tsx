import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/card";
import {
  AnalyticsChart,
  RecommendationPieChart,
  StatusPieChart,
  CaseTimelineChart,
  ScoreDistributionChart,
} from "@/components/analytics-chart";
import {
  avoidedCostPerCase,
  COST_SAVING_RECOMMENDATIONS,
  projectedMonthlySaving,
  resolveProductValueAed,
} from "@/lib/cost";
import { DEFAULT_PRODUCT_VALUE_AED } from "@/lib/catalogue";
import { RecommendationBadge } from "@/components/recommendation-badge";
import {
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  Zap,
  Brain,
  Target,
  BarChart3,
  DollarSign,
  ArrowRight,
  Shield,
  PieChart,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const MONTHLY_VOLUME_MULTIPLIER = 4;

export default async function DashboardPage() {
  const [totalCases, decisionGroups, analyses, recentCases, statusGroups, allCases] =
    await Promise.all([
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
          replacementValidityScore: true,
          createdAt: true,
          case: { select: { productModel: true, customerName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.case.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          analysis: { select: { recommendation: true, replacementValidityScore: true } },
          decision: { select: { decision: true } },
        },
      }),
      prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.case.findMany({
        select: {
          createdAt: true,
          analysis: { select: { createdAt: true, recommendation: true } },
          decision: { select: { decision: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const recommendationCounts: Record<string, number> = {};
  const decisionCounts: Record<string, number> = {};
  let totalAvoidedAed = 0;
  let totalLatencyMs = 0;
  let totalScore = 0;
  const allScores: number[] = [];

  for (const a of analyses) {
    recommendationCounts[a.recommendation] =
      (recommendationCounts[a.recommendation] ?? 0) + 1;
    totalLatencyMs += a.latencyMs;
    totalScore += a.replacementValidityScore;
    allScores.push(a.replacementValidityScore);
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
  for (const d of decisionGroups) decisionCounts[d.decision] = d._count._all;

  const statusMap: Record<string, number> = {};
  for (const s of statusGroups) statusMap[s.status] = s._count._all;

  const conservativeCount = Object.entries(recommendationCounts)
    .filter(([k]) => COST_SAVING_RECOMMENDATIONS.has(k))
    .reduce((sum, [, n]) => sum + n, 0);

  const projectedMonthlyAed = projectedMonthlySaving(
    conservativeCount * MONTHLY_VOLUME_MULTIPLIER,
    DEFAULT_PRODUCT_VALUE_AED
  );
  const avgLatency = analyses.length
    ? Math.round(totalLatencyMs / analyses.length)
    : 0;
  const avgScore = analyses.length
    ? Math.round(totalScore / analyses.length)
    : 0;

  const approvedCount = decisionCounts["approve"] ?? 0;
  const rejectedCount = decisionCounts["reject"] ?? 0;
  const pendingAnalysis = statusMap["new"] ?? 0;
  const pendingDecision = statusMap["analyzed"] ?? 0;

  // AI-Manager concordance
  let concordantCount = 0;
  let totalDecisions = 0;
  const CONCORDANCE_MAP: Record<string, string> = {
    approve_replacement: "approve",
    reject_request: "reject",
    request_more_evidence: "request_evidence",
    remote_troubleshooting: "remote_troubleshoot",
    escalate_manager: "escalate",
  };
  for (const c of allCases) {
    if (c.analysis && c.decision) {
      totalDecisions++;
      const mapped = CONCORDANCE_MAP[c.analysis.recommendation];
      if (mapped === c.decision.decision) concordantCount++;
    }
  }
  const concordanceRate = totalDecisions > 0
    ? Math.round((concordantCount / totalDecisions) * 100)
    : null;

  // Timeline data (group by date)
  const timelineMap = new Map<string, { cases: number; analyses: number }>();
  for (const c of allCases) {
    const dateKey = c.createdAt.toISOString().slice(0, 10);
    const entry = timelineMap.get(dateKey) ?? { cases: 0, analyses: 0 };
    entry.cases++;
    if (c.analysis) entry.analyses++;
    timelineMap.set(dateKey, entry);
  }
  const timeline = Array.from(timelineMap.entries())
    .map(([date, data]) => ({
      date: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
      }).format(new Date(date)),
      cases: data.cases,
      analyses: data.analyses,
    }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time overview of return cases, AI performance, and business
            impact.
          </p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span>+ New Case</span>
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Cases"
          value={totalCases.toString()}
          sub="All time"
          icon={<BarChart3 className="size-5 text-blue-600" />}
          color="blue"
        />
        <KPICard
          label="Analyses Run"
          value={analyses.length.toString()}
          sub={`${pendingAnalysis} awaiting analysis`}
          icon={<Brain className="size-5 text-violet-600" />}
          color="violet"
        />
        <KPICard
          label="Approved Cases"
          value={approvedCount.toString()}
          sub={`${rejectedCount} rejected`}
          icon={<CheckCircle2 className="size-5 text-emerald-600" />}
          color="emerald"
        />
        <KPICard
          label="Pending Decision"
          value={pendingDecision.toString()}
          sub="Awaiting manager"
          icon={<Clock className="size-5 text-amber-600" />}
          color="amber"
        />
      </div>

      {/* AI Performance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Avg RVS Score"
          value={`${avgScore}/100`}
          icon={<Target className="size-4 text-slate-500" />}
          note="Replacement Validity Score"
        />
        <MetricCard
          label="Avg AI Latency"
          value={`${avgLatency} ms`}
          icon={<Zap className="size-4 text-slate-500" />}
          note="Per analysis pipeline run"
        />
        <MetricCard
          label="Estimated Savings"
          value={`AED ${Math.round(totalAvoidedAed).toLocaleString()}`}
          icon={<DollarSign className="size-4 text-slate-500" />}
          note="Prevented unnecessary returns"
        />
        <MetricCard
          label="Projected Monthly"
          value={`AED ${Math.round(projectedMonthlyAed).toLocaleString()}`}
          icon={<TrendingUp className="size-4 text-slate-500" />}
          note={`${conservativeCount} conservative x ${MONTHLY_VOLUME_MULTIPLIER}x volume`}
        />
        <MetricCard
          label="AI-Manager Agreement"
          value={concordanceRate !== null ? `${concordanceRate}%` : "N/A"}
          icon={<Shield className="size-4 text-slate-500" />}
          note={totalDecisions > 0 ? `${concordantCount}/${totalDecisions} concordant` : "No decisions yet"}
        />
      </div>

      {/* Charts row 1: Recommendations + Status */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 bg-white shadow-sm border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                AI Recommendations
              </h2>
              <p className="text-xs text-slate-500">
                Distribution of AI outcomes across all analyzed cases
              </p>
            </div>
            <Activity className="size-4 text-slate-400" />
          </div>
          <AnalyticsChart counts={recommendationCounts} />
        </Card>

        <Card className="p-5 bg-white shadow-sm border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Case Status
              </h2>
              <p className="text-xs text-slate-500">
                Current pipeline status distribution
              </p>
            </div>
            <PieChart className="size-4 text-slate-400" />
          </div>
          <StatusPieChart statusCounts={statusMap} />
        </Card>
      </div>

      {/* Charts row 2: Timeline + Score Distribution + Pie */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 p-5 bg-white shadow-sm border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recommendation Breakdown
              </h2>
              <p className="text-xs text-slate-500">
                Proportion of each AI recommendation type
              </p>
            </div>
          </div>
          <RecommendationPieChart counts={recommendationCounts} />
        </Card>

        <Card className="p-5 bg-white shadow-sm border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                RVS Score Distribution
              </h2>
              <p className="text-xs text-slate-500">
                Replacement Validity Score spread
              </p>
            </div>
            <Target className="size-4 text-slate-400" />
          </div>
          <ScoreDistributionChart scores={allScores} />
        </Card>

        <Card className="p-5 bg-white shadow-sm border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Case Timeline
              </h2>
              <p className="text-xs text-slate-500">
                Cases created vs analyzed over time
              </p>
            </div>
            <TrendingUp className="size-4 text-slate-400" />
          </div>
          <CaseTimelineChart timeline={timeline} />
        </Card>
      </div>

      {/* Bottom row: Manager Decisions + Recent Cases */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Manager Decisions */}
        <Card className="lg:col-span-2 p-5 bg-white shadow-sm border-slate-200">
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            Manager Decisions
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Final human decisions on AI-analyzed cases
          </p>
          {Object.keys(decisionCounts).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="size-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No decisions recorded yet.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {Object.entries(decisionCounts).map(([k, v]) => (
                <li
                  key={k}
                  className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0"
                >
                  <RecommendationBadge value={k} size="sm" />
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 rounded-full bg-slate-200"
                      style={{ width: 60 }}
                    >
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{
                          width: `${Math.round(
                            (v /
                              Object.values(decisionCounts).reduce(
                                (a, b) => a + b,
                                0
                              )) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="tabular-nums font-semibold text-sm text-slate-700">
                      {v}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent Cases */}
        <Card className="lg:col-span-3 p-5 bg-white shadow-sm border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent Cases
              </h2>
              <p className="text-xs text-slate-500">Latest return requests</p>
            </div>
            <Link
              href="/"
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentCases.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No cases yet.
              </p>
            ) : (
              recentCases.map((c) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {c.customerName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {c.productModel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.analysis ? (
                      <>
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            c.analysis.replacementValidityScore >= 70
                              ? "text-emerald-600"
                              : c.analysis.replacementValidityScore >= 45
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        >
                          {c.analysis.replacementValidityScore}
                        </span>
                        <RecommendationBadge
                          value={c.analysis.recommendation}
                          size="sm"
                        />
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {c.status}
                      </span>
                    )}
                    <ArrowRight className="size-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* AI Advisory note */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
        <span className="mt-0.5 text-amber-500">&#9888;</span>
        <span>
          <strong>AI output is advisory.</strong> All recommendations above are
          generated by Gemini 2.0 Flash via a Multimodal RAG pipeline and must
          be reviewed by an authorised manager before any action is taken. Final
          decisions belong to the authorised manager only.
        </span>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: "blue" | "violet" | "emerald" | "amber";
}) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50",
    violet: "bg-violet-50",
    emerald: "bg-emerald-50",
    amber: "bg-amber-50",
  };
  return (
    <Card className="p-5 bg-white shadow-sm border-slate-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {value}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
        </div>
        <div className={`p-2 rounded-lg ${bg[color]}`}>{icon}</div>
      </div>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  note: string;
}) {
  return (
    <Card className="p-4 bg-white shadow-sm border-slate-200">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{note}</p>
    </Card>
  );
}
