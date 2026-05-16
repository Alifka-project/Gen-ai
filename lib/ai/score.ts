// lib/ai/score.ts
// Replacement Validity Score (RVS) — weighted formula from proposal §12.1
// and brief §6.4. This is a deterministic sanity check we recompute on top
// of the model's own score; large deltas (>20) are flagged.

import type { AiAnalysisJson, RecommendedAction } from "./schema";

const CONSERVATIVE_ACTIONS = new Set<RecommendedAction>([
  "request_more_evidence",
  "remote_troubleshooting",
  "send_technician",
  "escalate_manager",
]);

function documentEligibilityScore(d: AiAnalysisJson["document_analysis"]): number {
  let s = 0;
  if (d.invoice_valid === true) s += 35;
  if (d.warranty_status === "active") s += 35;
  if (d.return_window_status === "within") s += 30;
  // Unknown values give partial credit so a missing invoice doesn't tank the
  // score for a clear-DOA case where docs are still being collected.
  if (d.warranty_status === "unknown") s += 10;
  if (d.return_window_status === "unknown") s += 10;
  return Math.min(100, s);
}

function policyComplianceScore(
  p: AiAnalysisJson["policy_analysis"],
  action: RecommendedAction
): number {
  if (p.relevant_sections.length === 0) return 0;
  const baseline = 60 + Math.min(20, p.relevant_sections.length * 5);
  return CONSERVATIVE_ACTIONS.has(action)
    ? Math.min(100, baseline + 10)
    : baseline;
}

export function computeRVS(e: AiAnalysisJson): number {
  return Math.round(
    0.2 * e.complaint_analysis.clarity_score +
      0.2 * e.visual_analysis.evidence_quality_score +
      0.25 * documentEligibilityScore(e.document_analysis) +
      0.25 * policyComplianceScore(e.policy_analysis, e.recommended_action) +
      0.1 * 50 // historical/business context — fixed for MVP
  );
}

export function rvsDelta(e: AiAnalysisJson): number {
  return Math.abs(e.replacement_validity_score - computeRVS(e));
}

// Proposal §12.2 — the per-band recommendations the score is expected to map to.
type ExpectedBand = {
  scoreRange: [number, number];
  expected: RecommendedAction[];
  label: string;
};

const BANDS: ExpectedBand[] = [
  {
    scoreRange: [0, 30],
    expected: ["reject_request", "request_more_evidence"],
    label: "0-30: Reject or request evidence",
  },
  {
    scoreRange: [31, 50],
    expected: ["request_more_evidence", "remote_troubleshooting"],
    label: "31-50: Request more evidence",
  },
  {
    scoreRange: [51, 70],
    expected: ["remote_troubleshooting", "send_technician"],
    label: "51-70: Remote troubleshooting or technician inspection",
  },
  {
    scoreRange: [71, 85],
    expected: ["escalate_manager", "approve_replacement"],
    label: "71-85: Escalate to manager for likely approval",
  },
  {
    scoreRange: [86, 100],
    expected: ["approve_replacement", "escalate_manager"],
    label: "86-100: Recommend replacement approval",
  },
];

function bandForScore(score: number): ExpectedBand {
  return (
    BANDS.find((b) => score >= b.scoreRange[0] && score <= b.scoreRange[1]) ??
    BANDS[2]
  );
}

/**
 * Compare the AI's recommendation against the proposal's score→action band
 * (§12.2). Returns null when they're consistent, or a human-readable note
 * when they diverge (e.g. score 90 but action = reject_request).
 *
 * This is advisory — the AI may still be right (contradictions, policy
 * overrides), so we surface it as a flag, not an error.
 */
export function thresholdSanityCheck(e: AiAnalysisJson): string | null {
  const band = bandForScore(e.replacement_validity_score);
  if (band.expected.includes(e.recommended_action)) return null;
  return `Score ${e.replacement_validity_score} sits in the "${band.label}" band, but the AI recommended "${e.recommended_action}". Review the contradictions/policy citations before deciding.`;
}
