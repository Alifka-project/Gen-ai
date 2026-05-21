// lib/ai/consensus.ts
// Compute cross-model agreement between two independent analyses of the same
// case (the GPT-4o primary and the Claude Sonnet 4.5 secondary). The output
// is a single agreement object the orchestrator stamps onto the persisted
// analysis so the dashboard can show "both models said X" vs "models
// disagreed — escalate".

import type { AiAnalysisJson, RecommendedAction } from "./schema";

export type ConsensusLevel = "high" | "medium" | "low";

export type ConsensusReport = {
  /** Did both models pick the same recommended_action? */
  actionsMatch: boolean;
  /** Absolute delta of replacement_validity_score between models. */
  scoreDelta: number;
  /** How confident we are the two models genuinely agree. */
  level: ConsensusLevel;
  /** Recommended next step when actions disagree (the orchestrator may
   *  promote the case to escalate_manager when consensus is low). */
  resolution: RecommendedAction;
  /** Brief sentence the UI can show next to the badge. */
  summary: string;
  /** Categorical agreement on each major dimension. */
  byField: {
    recommended_action: boolean;
    complaint_category: boolean;
    severity: boolean;
    visible_damage: boolean;
    damage_type: boolean;
    warranty_status: boolean;
    return_window_status: boolean;
  };
  matchPct: number; // % of byField checks that match
};

const CONSERVATIVE_ACTIONS: RecommendedAction[] = [
  "request_more_evidence",
  "remote_troubleshooting",
  "send_technician",
  "escalate_manager",
];

function pickMoreConservative(
  a: RecommendedAction,
  b: RecommendedAction
): RecommendedAction {
  // When the two models disagree we resolve toward the safer action.
  // approve_replacement is the most aggressive (highest risk to company);
  // escalate_manager is the safest (lets a human decide).
  if (a === b) return a;
  if (a === "escalate_manager" || b === "escalate_manager") return "escalate_manager";
  // If either model wanted to approve and the other did not, escalate.
  if (a === "approve_replacement" || b === "approve_replacement") return "escalate_manager";
  // Otherwise prefer whichever is in the conservative bucket.
  if (CONSERVATIVE_ACTIONS.includes(a)) return a;
  if (CONSERVATIVE_ACTIONS.includes(b)) return b;
  return a;
}

export function computeConsensus(
  primary: AiAnalysisJson,
  secondary: AiAnalysisJson
): ConsensusReport {
  const actionsMatch =
    primary.recommended_action === secondary.recommended_action;
  const scoreDelta = Math.abs(
    primary.replacement_validity_score - secondary.replacement_validity_score
  );

  const byField = {
    recommended_action: actionsMatch,
    complaint_category:
      primary.complaint_analysis.category === secondary.complaint_analysis.category,
    severity: primary.complaint_analysis.severity === secondary.complaint_analysis.severity,
    visible_damage:
      primary.visual_analysis.visible_damage === secondary.visual_analysis.visible_damage,
    damage_type: primary.visual_analysis.damage_type === secondary.visual_analysis.damage_type,
    warranty_status:
      primary.document_analysis.warranty_status === secondary.document_analysis.warranty_status,
    return_window_status:
      primary.document_analysis.return_window_status === secondary.document_analysis.return_window_status,
  };
  const matches = Object.values(byField).filter(Boolean).length;
  const matchPct = Math.round((matches / Object.keys(byField).length) * 100);

  let level: ConsensusLevel = "low";
  if (actionsMatch && scoreDelta <= 15 && matchPct >= 70) level = "high";
  else if (actionsMatch && scoreDelta <= 30) level = "medium";
  else if (matchPct >= 70) level = "medium";

  const resolution = pickMoreConservative(
    primary.recommended_action,
    secondary.recommended_action
  );

  let summary: string;
  if (level === "high") {
    summary = `Both models agree on ${primary.recommended_action.replace(/_/g, " ")} with score delta ${scoreDelta}. High confidence.`;
  } else if (level === "medium" && actionsMatch) {
    summary = `Both models agree on ${primary.recommended_action.replace(/_/g, " ")} but score delta is ${scoreDelta}; review manually.`;
  } else if (level === "medium") {
    summary = `Models picked different actions but agree on ${matchPct}% of dimensions; resolving to ${resolution.replace(/_/g, " ")}.`;
  } else {
    summary = `Models disagree (${matchPct}% field agreement, score delta ${scoreDelta}). Escalating per safety policy: ${resolution.replace(/_/g, " ")}.`;
  }

  return {
    actionsMatch,
    scoreDelta,
    level,
    resolution,
    summary,
    byField,
    matchPct,
  };
}
