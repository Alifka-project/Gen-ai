// lib/ai/schema.ts
// Zod schema for the AI output (proposal Appendix A; brief §6.1).
// Every AI response is validated against this before being persisted.

import { z } from "zod";

export const complaintCategoryEnum = z.enum([
  "functional_issue",
  "visible_damage",
  "missing_accessory",
  "installation_issue",
  "cosmetic",
]);
export type ComplaintCategory = z.infer<typeof complaintCategoryEnum>;

export const severityEnum = z.enum(["low", "medium", "high", "critical"]);

export const damageTypeEnum = z.enum([
  "scratch",
  "dent",
  "broken_part",
  "leakage",
  "packaging_damage",
  "none_visible",
  "unclear",
]);

export const claimImageConsistencyEnum = z.enum([
  "supports_claim",
  "does_not_support_claim",
  "inconclusive",
]);

export const warrantyStatusEnum = z.enum(["active", "expired", "unknown"]);
export const returnWindowStatusEnum = z.enum(["within", "expired", "unknown"]);

export const recommendedActionEnum = z.enum([
  "approve_replacement",
  "reject_request",
  "request_more_evidence",
  "remote_troubleshooting",
  "send_technician",
  "escalate_manager",
]);
export type RecommendedAction = z.infer<typeof recommendedActionEnum>;

/** Provenance block stamped onto every analysis by the orchestrator. Tells
 * the dashboard exactly what raw evidence the model inspected so every score
 * can be traced back to its source (or to the absence of source). */
export const evidenceInspectedSchema = z.object({
  imageCount: z.number().int().min(0),
  pdfCount: z.number().int().min(0),
  pdfPagesRead: z.number().int().min(0),
  pdfCharsExtracted: z.number().int().min(0),
  scannedPdfCount: z.number().int().min(0),
  policyChunksRetrieved: z.number().int().min(0),
  guardEvents: z
    .array(
      z.object({
        field: z.string(),
        original: z.unknown(),
        enforced: z.unknown(),
        reason: z.string(),
      })
    )
    .default([]),
});
export type EvidenceInspected = z.infer<typeof evidenceInspectedSchema>;

export const aiAnalysisSchema = z.object({
  case_summary: z.string().min(1),
  complaint_analysis: z.object({
    category: complaintCategoryEnum,
    severity: severityEnum,
    clarity_score: z.number().min(0).max(100),
    missing_evidence: z.array(z.string()),
  }),
  visual_analysis: z.object({
    visible_damage: z.boolean(),
    damage_type: damageTypeEnum,
    evidence_quality_score: z.number().min(0).max(100),
    serial_number_visible: z.boolean(),
    claim_image_consistency: claimImageConsistencyEnum,
    visual_uncertainty: z.string(),
  }),
  document_analysis: z.object({
    invoice_valid: z.boolean().nullable(),
    warranty_status: warrantyStatusEnum,
    return_window_status: returnWindowStatusEnum,
    product_value_aed: z.number().nullable(),
    extracted_fields: z.object({
      invoice_number: z.string().nullable(),
      customer_name: z.string().nullable(),
      product_model: z.string().nullable(),
      serial_number: z.string().nullable(),
      invoice_date: z.string().nullable(),
      delivery_date: z.string().nullable(),
      warranty_start_date: z.string().nullable(),
      warranty_end_date: z.string().nullable(),
    }),
  }),
  policy_analysis: z.object({
    // Hard rule: at least one section must be cited.
    relevant_sections: z.array(z.string()).min(1),
    policy_result: z.string(),
  }),
  contradictions: z.array(z.string()),
  verified_facts: z.array(z.string()),
  uncertainties: z.array(z.string()),
  replacement_validity_score: z.number().min(0).max(100),
  recommended_action: recommendedActionEnum,
  manager_summary: z.string().min(1),
  /** Stamped by the orchestrator after evidence-guard processing. Always
   * present on persisted analyses; optional on the raw model output. */
  evidence_inspected: evidenceInspectedSchema.optional(),
});

export type AiAnalysisJson = z.infer<typeof aiAnalysisSchema>;

// Functional-defect categories — used by analyze.ts to enforce hard rule #3
// even if the model momentarily forgets it.
export const FUNCTIONAL_CATEGORIES: ComplaintCategory[] = ["functional_issue"];

export function isFunctionalDefect(c: AiAnalysisJson): boolean {
  return FUNCTIONAL_CATEGORIES.includes(c.complaint_analysis.category);
}
