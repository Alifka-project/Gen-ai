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

export const dynamic = "force-dynamic";

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
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/" className="text-xs text-muted-foreground hover:underline">
            ← all cases
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {c.customerName} — {c.productModel}
          </h1>
          <p className="text-sm text-muted-foreground">
            Case <code className="font-mono">{c.id}</code> · requested: {c.requestedAction}
            {c.serialNumber ? ` · serial ${c.serialNumber}` : ""}
          </p>
        </div>
        <AnalyzeButton caseId={c.id} hasAnalysis={!!c.analysis} />
      </div>

      {!c.analysis ? (
        <Card className="p-6 text-sm">
          <p>No analysis yet. Click <strong>Run analysis</strong> to call the multimodal pipeline.</p>
          <p className="text-muted-foreground mt-1">
            The pipeline will retrieve the top 5 policy chunks, send the complaint + any uploaded
            files to Gemini Flash, validate the JSON output, and recompute the weighted RVS.
          </p>
        </Card>
      ) : !validAnalysis ? (
        <Card className="p-6 border-red-300 bg-red-50 text-sm text-red-900">
          <p className="font-medium">Stored analysis failed schema validation.</p>
          <p className="text-xs mt-1">
            This is unexpected — re-run the analysis. Errors:{" "}
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

          {validAnalysis.contradictions.length > 0 ? (
            <Card className="p-4 border-red-300 bg-red-50">
              <p className="text-sm font-medium text-red-900">
                ⚠ Contradictions flagged — case must be reviewed by a manager
              </p>
              <ul className="text-sm text-red-900 mt-2 list-disc pl-5">
                {validAnalysis.contradictions.map((cn, i) => (
                  <li key={i}>{cn}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-4">
            <p className="text-sm">
              <strong>Manager summary:</strong> {validAnalysis.manager_summary}
            </p>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4 border-green-200 bg-green-50/50">
              <h3 className="text-sm font-semibold text-green-900 mb-2">
                Verified facts ({validAnalysis.verified_facts.length})
              </h3>
              {validAnalysis.verified_facts.length === 0 ? (
                <p className="text-xs text-green-900/70 italic">
                  The AI did not list any verified facts. This usually means the
                  evidence was insufficient to confirm anything beyond the complaint text.
                </p>
              ) : (
                <ul className="text-sm text-green-900 list-disc pl-5 space-y-1">
                  {validAnalysis.verified_facts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-4 border-amber-200 bg-amber-50/50">
              <h3 className="text-sm font-semibold text-amber-900 mb-2">
                Uncertainties ({validAnalysis.uncertainties.length})
              </h3>
              {validAnalysis.uncertainties.length === 0 ? (
                <p className="text-xs text-amber-900/70 italic">
                  The AI did not list any uncertainties. Spot-check the
                  recommendation manually if it is high-impact.
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

          {validAnalysis.complaint_analysis.missing_evidence.length > 0 ? (
            <Card className="p-4 border-blue-200 bg-blue-50/50">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                Missing evidence to collect
              </h3>
              <ul className="text-sm text-blue-900 list-disc pl-5 space-y-1">
                {validAnalysis.complaint_analysis.missing_evidence.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Card>
          ) : null}

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
