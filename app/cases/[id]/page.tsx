import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/card";
import { ScoreCard } from "@/components/score-card";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { AnalyzeButton } from "@/components/analyze-button";
import { DecisionPanel } from "@/components/decision-panel";
import { computeRVS, thresholdSanityCheck } from "@/lib/ai/score";
import { aiAnalysisSchema } from "@/lib/ai/schema";
import {
  ArrowLeft,
  Package,
  Hash,
  Wrench,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
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
    analyzing: "Analyzing…",
    analyzed: "AI Analyzed",
    decided: "Decided",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default async function CasePage({ params }: { params: { id: string } }) {
  const c = await prisma.case.findUnique({
    where: { id: params.id },
    include: { documents: true, analysis: true, decision: true },
  });

  if (!c) notFound();

  let analysisJson: ReturnType<typeof aiAnalysisSchema.safeParse> | null = null;
  if (c.analysis) {
    analysisJson = aiAnalysisSchema.safeParse(c.analysis.explanationJson);
  }
  const validAnalysis = analysisJson?.success ? analysisJson.data : null;
  const rvsRecomputed = validAnalysis ? computeRVS(validAnalysis) : undefined;
  const thresholdWarning = validAnalysis ? thresholdSanityCheck(validAnalysis) : null;

  const retrievedChunks =
    (c.analysis?.retrievedChunks as Array<{
      id: string;
      policyName: string;
      sectionRef: string;
      score: number;
    }> | null) ?? [];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        All Cases
      </Link>

      {/* Case Header */}
      <Card className="p-5 bg-white shadow-sm border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={c.status} />
              {c.status === "analyzing" && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                  <Cpu className="size-3 animate-pulse" />
                  AI analysis in progress…
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {c.customerName}
            </h1>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Package className="size-3.5" />
                {c.productModel}
              </span>
              {c.serialNumber && (
                <span className="flex items-center gap-1">
                  <Hash className="size-3.5" />
                  {c.serialNumber}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Wrench className="size-3.5" />
                {c.requestedAction}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                {new Intl.DateTimeFormat("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(c.createdAt)}
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Hash className="size-3" />
                {c.id}
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">
                Complaint
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{c.complaintText}</p>
            </div>
          </div>
          <div className="shrink-0">
            <AnalyzeButton caseId={c.id} hasAnalysis={!!c.analysis} />
          </div>
        </div>
      </Card>

      {/* Documents count */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <CheckCircle2 className="size-3.5 text-slate-400" />
        {c.documents.length} document{c.documents.length !== 1 ? "s" : ""} attached
        {!c.analysis && (
          <span className="ml-2 text-amber-600 flex items-center gap-1">
            <Clock className="size-3.5" />
            Click <strong>Run Analysis</strong> to process with Gemini AI
          </span>
        )}
      </div>

      {/* Analysis */}
      {!c.analysis ? (
        <Card className="p-6 bg-white shadow-sm border-slate-200">
          <div className="flex items-start gap-3">
            <Cpu className="size-5 text-slate-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-1">
                No AI Analysis Yet
              </p>
              <p className="text-sm text-slate-500">
                Click <strong>Run Analysis</strong> above to trigger the Multimodal RAG pipeline.
                Gemini 2.0 Flash will analyze the complaint text, uploaded images, invoice PDF, and
                top-5 matched policy chunks.
              </p>
            </div>
          </div>
        </Card>
      ) : !validAnalysis ? (
        <Card className="p-6 border-red-300 bg-red-50 text-sm text-red-900">
          <p className="font-medium">Stored analysis failed schema validation.</p>
          <p className="text-xs mt-1">
            Re-run the analysis. Errors:{" "}
            {analysisJson && !analysisJson.success
              ? JSON.stringify(analysisJson.error.issues)
              : "unknown"}
          </p>
        </Card>
      ) : (
        <>
          <ScoreCard
            score={c.analysis.replacementValidityScore}
            recommendation={c.analysis.recommendation}
            rvsRecomputed={rvsRecomputed}
            thresholdWarning={thresholdWarning}
          />

          {validAnalysis.contradictions.length > 0 && (
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-sm font-semibold text-red-900 mb-2">
                ⚠ Contradictions Detected — Manager Review Required
              </p>
              <ul className="text-sm text-red-800 list-disc pl-5 space-y-1">
                {validAnalysis.contradictions.map((cn, i) => (
                  <li key={i}>{cn}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-4 bg-slate-900 border-slate-800">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
              AI Manager Summary
            </p>
            <p className="text-sm text-white leading-relaxed">
              {validAnalysis.manager_summary}
            </p>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4 border-emerald-200 bg-emerald-50">
              <h3 className="text-sm font-semibold text-emerald-900 mb-2">
                Verified Facts ({validAnalysis.verified_facts.length})
              </h3>
              {validAnalysis.verified_facts.length === 0 ? (
                <p className="text-xs text-emerald-700 italic">
                  No verified facts — evidence was insufficient to confirm anything beyond the complaint text.
                </p>
              ) : (
                <ul className="text-sm text-emerald-900 list-disc pl-5 space-y-1">
                  {validAnalysis.verified_facts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-4 border-amber-200 bg-amber-50">
              <h3 className="text-sm font-semibold text-amber-900 mb-2">
                Uncertainties ({validAnalysis.uncertainties.length})
              </h3>
              {validAnalysis.uncertainties.length === 0 ? (
                <p className="text-xs text-amber-700 italic">
                  No uncertainties flagged. Spot-check the recommendation manually for high-impact decisions.
                </p>
              ) : (
                <ul className="text-sm text-amber-900 list-disc pl-5 space-y-1">
                  {validAnalysis.uncertainties.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {validAnalysis.complaint_analysis.missing_evidence.length > 0 && (
            <Card className="p-4 border-blue-200 bg-blue-50">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                Missing Evidence to Collect
              </h3>
              <ul className="text-sm text-blue-900 list-disc pl-5 space-y-1">
                {validAnalysis.complaint_analysis.missing_evidence.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Card>
          )}

          <DashboardTabs
            complaintText={c.complaintText}
            productModel={c.productModel}
            analysis={validAnalysis}
            documents={c.documents.map((d) => ({
              id: d.id,
              docType: d.docType,
              blobUrl: d.blobUrl,
              mimeType: d.mimeType,
            }))}
            retrievedChunks={retrievedChunks}
          />
        </>
      )}

      <DecisionPanel
        caseId={c.id}
        currentDecision={c.decision?.decision ?? null}
        currentNote={c.decision?.managerNote ?? null}
      />
    </div>
  );
}
