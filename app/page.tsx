import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/card";
import { RecommendationBadge } from "@/components/recommendation-badge";
import { CaseAiInsight } from "@/components/case-ai-insight";
import { aiAnalysisSchema } from "@/lib/ai/schema";
import {
  PlusCircle,
  FolderOpen,
  CheckCircle2,
  Clock,
  Brain,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-slate-100 text-slate-600 border-slate-200",
    analyzing: "bg-blue-100 text-blue-700 border-blue-200",
    analyzed: "bg-violet-100 text-violet-700 border-violet-200",
    decided: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  const labels: Record<string, string> = {
    new: "New",
    analyzing: "Analyzing",
    analyzed: "Analyzed",
    decided: "Decided",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        styles[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 70
      ? "text-emerald-700 bg-emerald-50"
      : score >= 45
      ? "text-amber-700 bg-amber-50"
      : "text-red-700 bg-red-50";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

export default async function CasesPage() {
  let cases: Awaited<ReturnType<typeof loadCases>> = [];
  let loadError: string | null = null;

  try {
    cases = await loadCases();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "failed to load cases";
  }

  // Stats for the top KPI bar
  const total = cases.length;
  const analyzed = cases.filter((c) => c.analysis).length;
  const decided = cases.filter((c) => c.decision).length;
  const pending = cases.filter((c) => !c.analysis).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Return Cases
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Customer complaints awaiting AI analysis or manager decision.
          </p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
        >
          <PlusCircle className="size-4" />
          New Case
        </Link>
      </div>

      {/* Mini KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: total, icon: <FolderOpen className="size-4 text-slate-400" /> },
          { label: "Pending Analysis", value: pending, icon: <Clock className="size-4 text-amber-400" /> },
          { label: "AI Analyzed", value: analyzed, icon: <Brain className="size-4 text-violet-400" /> },
          { label: "Decided", value: decided, icon: <CheckCircle2 className="size-4 text-emerald-400" /> },
        ].map((s) => (
          <Card key={s.label} className="p-3 bg-white shadow-sm border-slate-200">
            <div className="flex items-center justify-between">
              {s.icon}
              <span className="text-xl font-bold tabular-nums text-slate-900">
                {s.value}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Error */}
      {loadError ? (
        <Card className="p-6 border-red-300 bg-red-50 text-sm text-red-900">
          <p className="font-medium mb-1">Could not load cases.</p>
          <p className="font-mono text-xs whitespace-pre-wrap">{loadError}</p>
          <p className="mt-2">
            Check that <code>DATABASE_URL</code> is set and{" "}
            <code>pnpm prisma migrate dev --name init</code> has been run.
          </p>
        </Card>
      ) : cases.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-white">
          <FolderOpen className="size-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No cases yet.</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">
            Create one to run the AI analysis pipeline.
          </p>
          <Link
            href="/cases/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <PlusCircle className="size-4" />
            Create First Case
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Cases Table */}
          <Card className="overflow-hidden bg-white shadow-sm border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Customer
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Product
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 max-w-xs">
                      Complaint
                    </th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Files
                    </th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      RVS
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      AI Recommendation
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Decision
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Created
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cases.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/cases/${c.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {c.customerName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                        {c.productModel}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-slate-500 truncate leading-relaxed">
                          {c.complaintText}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500 tabular-nums">
                        {c._count.documents}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.analysis ? (
                          <ScorePill score={c.analysis.replacementValidityScore} />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.analysis ? (
                          <RecommendationBadge
                            value={c.analysis.recommendation}
                            size="sm"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.decision ? (
                          <RecommendationBadge value={c.decision.decision} size="sm" />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                        {new Intl.DateTimeFormat("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(c.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/cases/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        >
                          View <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* AI Assessment Cards */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="size-4 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">
                AI Assessment Cards
              </h2>
              <span className="text-xs text-slate-400">
                — Detailed AI analysis for each case (for AI expert review)
              </span>
            </div>
            <div className="space-y-3">
              {cases
                .filter((c) => c.analysis)
                .map((c) => {
                  const explanation = c.analysis?.explanationJson as Record<string, unknown> | null;
                  const parsed = explanation
                    ? aiAnalysisSchema.safeParse(explanation)
                    : null;
                  const valid = parsed?.success ? parsed.data : null;

                  return (
                    <CaseAiInsight
                      key={c.id}
                      caseId={c.id}
                      customerName={c.customerName}
                      score={c.analysis!.replacementValidityScore}
                      managerSummary={valid?.manager_summary ?? "No summary available."}
                      clarityScore={valid?.complaint_analysis.clarity_score}
                      evidenceQuality={valid?.visual_analysis.evidence_quality_score}
                      retrievedChunks={
                        (c.analysis?.retrievedChunks as Array<{
                          policyName: string;
                          sectionRef: string;
                          score: number;
                        }> | null) ?? []
                      }
                      verifiedFacts={valid?.verified_facts ?? []}
                      uncertainties={valid?.uncertainties ?? []}
                      contradictions={valid?.contradictions ?? []}
                      complaintCategory={valid?.complaint_analysis.category}
                      severity={valid?.complaint_analysis.severity}
                      modelUsed={c.analysis?.modelUsed}
                      latencyMs={c.analysis?.latencyMs}
                      visibleDamage={valid?.visual_analysis.visible_damage}
                      damageType={valid?.visual_analysis.damage_type}
                      claimImageConsistency={valid?.visual_analysis.claim_image_consistency}
                      serialNumberVisible={valid?.visual_analysis.serial_number_visible}
                      invoiceValid={valid?.document_analysis.invoice_valid}
                      warrantyStatus={valid?.document_analysis.warranty_status}
                      returnWindowStatus={valid?.document_analysis.return_window_status}
                      productValueAed={valid?.document_analysis.product_value_aed}
                      relevantSections={valid?.policy_analysis.relevant_sections}
                      policyResult={valid?.policy_analysis.policy_result}
                    />
                  );
                })}
              {cases.filter((c) => c.analysis).length === 0 && (
                <Card className="p-6 border-dashed border-slate-300 text-center">
                  <Brain className="size-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    No AI analyses run yet. Open a case and click{" "}
                    <strong>Run Analysis</strong>.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function loadCases() {
  return prisma.case.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      analysis: {
        select: {
          recommendation: true,
          replacementValidityScore: true,
          retrievedChunks: true,
          explanationJson: true,
          modelUsed: true,
          latencyMs: true,
        },
      },
      decision: { select: { decision: true } },
      _count: { select: { documents: true } },
    },
  });
}
