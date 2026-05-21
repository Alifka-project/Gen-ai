// lib/ai/evidence-guards.ts
// Deterministic post-processing applied to every AI response BEFORE it is
// persisted. The prompt asks the model to honour evidence-source rules, but we
// also enforce them here so a model regression cannot leak hallucinated
// numbers into the database.
//
// Each guard documents WHICH input it inspects and WHICH output field it
// overrides — so when a manager asks "where did this number come from?" we
// can answer deterministically.

import type { AiAnalysisJson } from "./schema";

export type EvidenceContext = {
  imageCount: number;
  pdfCount: number;
  pdfCharsExtracted: number;
};

export type GuardEvent = {
  field: string;
  original: unknown;
  enforced: unknown;
  reason: string;
};

/**
 * Apply evidence-source guards to the AI's raw output. Returns the cleaned
 * analysis plus a list of guard events (for audit log + dashboard display).
 *
 * Visual fields are zeroed/nulled when no image was attached.
 * Document fields are nulled when no PDF text was extracted.
 * product_value_aed is forced to null when no PDF text was extracted (catches
 * the "AI copied catalogue value into the invoice field" hallucination).
 */
export function applyEvidenceGuards(
  analysis: AiAnalysisJson,
  ctx: EvidenceContext
): { cleaned: AiAnalysisJson; events: GuardEvent[] } {
  const events: GuardEvent[] = [];
  const cleaned: AiAnalysisJson = JSON.parse(JSON.stringify(analysis));

  // ── VISUAL GUARDS ────────────────────────────────────────────────────────
  if (ctx.imageCount === 0) {
    if (cleaned.visual_analysis.visible_damage !== false) {
      events.push({
        field: "visual_analysis.visible_damage",
        original: cleaned.visual_analysis.visible_damage,
        enforced: false,
        reason: "no image was attached — visible_damage cannot be true",
      });
      cleaned.visual_analysis.visible_damage = false;
    }
    if (cleaned.visual_analysis.damage_type !== "unclear") {
      events.push({
        field: "visual_analysis.damage_type",
        original: cleaned.visual_analysis.damage_type,
        enforced: "unclear",
        reason: "no image was attached — damage type cannot be determined",
      });
      cleaned.visual_analysis.damage_type = "unclear";
    }
    if (cleaned.visual_analysis.evidence_quality_score !== 0) {
      events.push({
        field: "visual_analysis.evidence_quality_score",
        original: cleaned.visual_analysis.evidence_quality_score,
        enforced: 0,
        reason: "no image was attached — image quality cannot be scored",
      });
      cleaned.visual_analysis.evidence_quality_score = 0;
    }
    if (cleaned.visual_analysis.serial_number_visible !== false) {
      events.push({
        field: "visual_analysis.serial_number_visible",
        original: cleaned.visual_analysis.serial_number_visible,
        enforced: false,
        reason: "no image was attached — serial cannot be visible",
      });
      cleaned.visual_analysis.serial_number_visible = false;
    }
    if (cleaned.visual_analysis.claim_image_consistency !== "inconclusive") {
      events.push({
        field: "visual_analysis.claim_image_consistency",
        original: cleaned.visual_analysis.claim_image_consistency,
        enforced: "inconclusive",
        reason: "no image was attached — claim/image consistency is inconclusive",
      });
      cleaned.visual_analysis.claim_image_consistency = "inconclusive";
    }
    if (
      !cleaned.visual_analysis.visual_uncertainty
        .toLowerCase()
        .includes("no image")
    ) {
      const stamp = "No image evidence was provided. ";
      events.push({
        field: "visual_analysis.visual_uncertainty",
        original: cleaned.visual_analysis.visual_uncertainty,
        enforced: stamp + cleaned.visual_analysis.visual_uncertainty,
        reason: "no image — prepend explicit no-image marker",
      });
      cleaned.visual_analysis.visual_uncertainty =
        stamp + cleaned.visual_analysis.visual_uncertainty;
    }
    // Damage regions can only come from images.
    if (cleaned.visual_analysis.damage_regions.length > 0) {
      events.push({
        field: "visual_analysis.damage_regions",
        original: `${cleaned.visual_analysis.damage_regions.length} regions`,
        enforced: 0,
        reason: "no image — damage regions cannot be inferred from text alone",
      });
      cleaned.visual_analysis.damage_regions = [];
    }
    // Serial number text can only come from a visible sticker in an image.
    if (cleaned.visual_analysis.serial_number_text !== null) {
      events.push({
        field: "visual_analysis.serial_number_text",
        original: cleaned.visual_analysis.serial_number_text,
        enforced: null,
        reason: "no image — serial number text cannot be read",
      });
      cleaned.visual_analysis.serial_number_text = null;
    }
    // Observed product fields can only be derived from an image.
    const op = cleaned.visual_analysis.observed_product;
    const hadAny =
      op.brand !== null ||
      op.product_type !== null ||
      op.approximate_capacity_kg !== null ||
      op.color !== null ||
      op.distinguishing_features.length > 0;
    if (hadAny) {
      events.push({
        field: "visual_analysis.observed_product",
        original: "non-null fields present",
        enforced: "all null",
        reason: "no image — observed_product cannot be derived from text",
      });
      cleaned.visual_analysis.observed_product = {
        brand: null,
        product_type: null,
        approximate_capacity_kg: null,
        color: null,
        distinguishing_features: [],
      };
    }
  } else {
    // Image(s) attached. Drop any region whose visible_in_images is empty —
    // that's a region the model inferred without actually pointing to an
    // image, which violates the schema's intent.
    const before = cleaned.visual_analysis.damage_regions.length;
    cleaned.visual_analysis.damage_regions =
      cleaned.visual_analysis.damage_regions.filter(
        (r) => Array.isArray(r.visible_in_images) && r.visible_in_images.length > 0
      );
    const dropped = before - cleaned.visual_analysis.damage_regions.length;
    if (dropped > 0) {
      events.push({
        field: "visual_analysis.damage_regions",
        original: `${before} regions`,
        enforced: `${cleaned.visual_analysis.damage_regions.length} regions`,
        reason: `dropped ${dropped} region(s) with empty visible_in_images (unsupported by image evidence)`,
      });
    }
  }

  // ── DOCUMENT GUARDS ──────────────────────────────────────────────────────
  const noPdfText = ctx.pdfCount === 0 || ctx.pdfCharsExtracted < 50;

  if (noPdfText) {
    if (cleaned.document_analysis.invoice_valid !== null) {
      events.push({
        field: "document_analysis.invoice_valid",
        original: cleaned.document_analysis.invoice_valid,
        enforced: null,
        reason: "no machine-readable invoice text — invoice_valid forced to null",
      });
      cleaned.document_analysis.invoice_valid = null;
    }
    if (cleaned.document_analysis.product_value_aed !== null) {
      events.push({
        field: "document_analysis.product_value_aed",
        original: cleaned.document_analysis.product_value_aed,
        enforced: null,
        reason:
          "no invoice text — product_value_aed cannot be derived (catalogue estimate is not invoice evidence)",
      });
      cleaned.document_analysis.product_value_aed = null;
    }
    // All extracted_fields are PDF-derived; null them out.
    const fields = cleaned.document_analysis.extracted_fields;
    for (const k of Object.keys(fields) as Array<keyof typeof fields>) {
      if (fields[k] !== null) {
        events.push({
          field: `document_analysis.extracted_fields.${k}`,
          original: fields[k],
          enforced: null,
          reason: "no invoice text — extracted fields must be null",
        });
        fields[k] = null;
      }
    }
  }

  // ── SCORE GUARD ──────────────────────────────────────────────────────────
  // With no image AND no PDF, the score must be in 0-30 (rule G).
  if (ctx.imageCount === 0 && noPdfText && cleaned.replacement_validity_score > 30) {
    events.push({
      field: "replacement_validity_score",
      original: cleaned.replacement_validity_score,
      enforced: 30,
      reason:
        "no image and no PDF — score capped at 30 per scoring rule G (text-only complaint)",
    });
    cleaned.replacement_validity_score = 30;
  }

  return { cleaned, events };
}
