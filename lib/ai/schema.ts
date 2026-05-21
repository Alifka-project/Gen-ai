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

/** Identity verification stamped by the deterministic identity-verifier
 *  module after the AI returns. Answers "is the photographed product
 *  actually the item the customer purchased?" with traceable checks. */
export const identityVerificationSchema = z.object({
  /** Serial extracted from intake form (typed by CS agent). */
  form_serial: z.string().nullable(),
  /** Serial extracted from invoice PDF by AI document analysis. */
  invoice_serial: z.string().nullable(),
  /** Serial extracted from the product sticker in the photo by AI vision. */
  photo_serial: z.string().nullable(),
  /** 3-way match status across the three serial sources. */
  serial_match: z.enum(["match", "partial_match", "mismatch", "insufficient_data"]),
  /** Number of sources where a serial was found. */
  serial_sources_count: z.number().int().min(0).max(3),
  /** Customer-name match between intake form and invoice. */
  customer_name_match: z.object({
    form_name: z.string(),
    invoice_name: z.string().nullable(),
    matches: z.boolean(),
    similarity: z.number().min(0).max(100),
  }),
  /** Does the photographed product match the catalogue product the case
   *  was filed for? Computed from visual_analysis.observed_product vs
   *  the catalogue entry for case.productModel. */
  product_match: z.object({
    expected_brand: z.string(),
    expected_type: z.string(),
    expected_capacity_kg: z.string(),
    observed_brand: z.string().nullable(),
    observed_type: z.string().nullable(),
    observed_capacity_kg: z.string().nullable(),
    brand_matches: z.boolean(),
    type_matches: z.boolean(),
    capacity_matches: z.boolean(),
    overall_match: z.boolean(),
  }),
  /** EXIF timestamp + GPS from the FIRST image (if available). */
  exif: z
    .object({
      taken_at: z.string().nullable(),
      gps_lat: z.number().nullable(),
      gps_lon: z.number().nullable(),
      camera: z.string().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
    })
    .nullable(),
  /** Overall verdict — true only when serial_match=match AND
   *  product_match.overall_match AND no severe issues. */
  identity_verified: z.boolean(),
  /** Human-readable issues for the manager UI. */
  identity_issues: z.array(z.string()).default([]),
  /** 0-100 score derived from the checks. */
  identity_score: z.number().min(0).max(100),
});
export type IdentityVerification = z.infer<typeof identityVerificationSchema>;

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
    /** ACTUAL serial number text the vision model read off the product
     *  sticker in any attached image. null when not visible / illegible. */
    serial_number_text: z.string().nullable().default(null),
    claim_image_consistency: claimImageConsistencyEnum,
    visual_uncertainty: z.string(),
    /** Specific damage regions identified on the product. Each entry must
     *  refer to a real region the model OBSERVED in an attached image.
     *  Empty array when no images are attached or no damage is visible. */
    damage_regions: z
      .array(
        z.object({
          region: z.string().min(1),
          description: z.string().min(1),
          severity: severityEnum,
          visible_in_images: z.array(z.number().int().positive()),
        })
      )
      .default([]),
    /** Vision-derived description of the product visible in the photo(s).
     *  The identity verifier compares this against the catalogue product
     *  the case was filed for. All fields null when no image attached. */
    observed_product: z
      .object({
        brand: z.string().nullable(),
        product_type: z.string().nullable(), // "front-load washer", "top-load washer", "dryer", "washer-dryer combo"
        approximate_capacity_kg: z.string().nullable(), // "8", "10", "10/6" — what's printed on the unit
        color: z.string().nullable(),
        distinguishing_features: z.array(z.string()).default([]),
      })
      .default({
        brand: null,
        product_type: null,
        approximate_capacity_kg: null,
        color: null,
        distinguishing_features: [],
      }),
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
  /** Stamped by the orchestrator from the deterministic identity verifier
   * (lib/ai/identity-verifier.ts). Optional because legacy analyses may not
   * have it. */
  identity_verification: identityVerificationSchema.optional(),
  /** Multi-model ensemble metadata. Present when MULTI_MODEL_ENABLED is on
   * (default) — records the secondary analyzer's full output, the critic's
   * verdict, and the consensus report. The primary recommendation at the
   * top level still wins; multi_model is for transparency + manager review. */
  multi_model: z
    .object({
      primary_model: z.string(),
      secondary_model: z.string(),
      secondary_recommendation: z.string(),
      secondary_score: z.number(),
      secondary_summary: z.string(),
      consensus: z.object({
        actionsMatch: z.boolean(),
        scoreDelta: z.number(),
        level: z.enum(["high", "medium", "low"]),
        resolution: z.string(),
        summary: z.string(),
        matchPct: z.number(),
        byField: z.record(z.string(), z.boolean()),
      }),
      critic: z
        .object({
          agrees_with_primary: z.boolean(),
          confidence: z.number(),
          disputed_fields: z.array(z.string()),
          critique: z.string(),
          alternate_recommendation: z.string().nullable(),
          model_used: z.string(),
        })
        .optional(),
    })
    .optional(),
});

export type AiAnalysisJson = z.infer<typeof aiAnalysisSchema>;

// Functional-defect categories — used by analyze.ts to enforce hard rule #3
// even if the model momentarily forgets it.
export const FUNCTIONAL_CATEGORIES: ComplaintCategory[] = ["functional_issue"];

export function isFunctionalDefect(c: AiAnalysisJson): boolean {
  return FUNCTIONAL_CATEGORIES.includes(c.complaint_analysis.category);
}
