import { NextResponse } from "next/server";
import { analyzeCase } from "@/lib/ai/analyze";
import { recordAudit } from "@/lib/db/audit";

// Allow longer execution since Gemini calls can take 10–30s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await analyzeCase(params.id);
    await recordAudit({
      caseId: params.id,
      actor: "system",
      action: "analysis_run",
      details: {
        recommendation: result.analysis.recommended_action,
        score: result.analysis.replacement_validity_score,
        rvsRecomputed: result.rvsRecomputed,
        rvsDelta: result.rvsDelta,
        latencyMs: result.latencyMs,
        contradictions: result.analysis.contradictions.length,
        citations: result.analysis.policy_analysis.relevant_sections.length,
        modelUsed: result.modelUsed,
      },
    });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    await recordAudit({
      caseId: params.id,
      actor: "system",
      action: "analysis_failed",
      details: { error: msg },
    });
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
