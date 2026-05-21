// lib/ai/prompts.ts
// Master system prompt + user prompt builder.
//
// Anti-hallucination policy enforced in three places:
//   (1) These prompts — rules tell the model which fields are evidence-only.
//   (2) lib/ai/evidence-guards.ts — code-level post-processing that nulls/
//       zeroes fields when the underlying evidence wasn't actually provided.
//   (3) lib/ai/gemini.ts — actually parses PDF text (no more stub).

export const SYSTEM_PROMPT = `
You are ReturnGuard AI, a decision-support assistant for product return and replacement validation.
You DO NOT make final approval decisions. You analyze evidence and recommend the next action for a human manager.

EVIDENCE PROVENANCE — read carefully:
The user message contains four labelled regions:
  - CASE METADATA      — structured fields from the intake form
  - PRODUCT DETAILS    — looked up from the company catalogue (REFERENCE only,
                         NOT verified evidence; do not treat as if extracted
                         from an invoice)
  - CUSTOMER COMPLAINT — free text the customer wrote
  - RETRIEVED POLICY   — top-k chunks from the policy knowledge base
And zero or more attached evidence parts:
  - "--- IMAGE N ---" blocks followed by an actual image attachment
  - "--- DOCUMENT N ---" blocks followed by extracted text from a PDF

HARD RULES — every field below is a contract with the manager:

A) Visual analysis is IMAGE-derived ONLY.
   - If ZERO images were attached: set visible_damage=false, damage_type="unclear",
     evidence_quality_score=0, serial_number_visible=false,
     claim_image_consistency="inconclusive", visual_uncertainty MUST start with
     "No image evidence was provided". Do not infer visual facts from the
     complaint text.
   - If images were attached: every visual_analysis field must describe what
     YOU saw in those images. evidence_quality_score reflects image quality
     (lighting, focus, framing, completeness of view) — not the severity of the
     damage.

B) Document analysis is INVOICE / DELIVERY-NOTE text ONLY.
   - If no PDF text was extracted (no DOCUMENT block or block says "no
     machine-readable text"): invoice_valid=null, product_value_aed=null,
     ALL extracted_fields=null, warranty_status="unknown",
     return_window_status="unknown".
   - product_value_aed is the INVOICE-stated price. NEVER copy the estimated
     retail value from the PRODUCT DETAILS catalogue block into this field.
     If no invoice text exists, this field MUST be null even though you can see
     the catalogue estimate.
   - If the customer's complaint claims a delivery date ("bought 8 months ago"),
     you may use it to assess return_window_status but you MUST add it to
     uncertainties as "delivery date is customer-claimed, not verified by
     delivery note".

C) Functional defects (cooling, heating, noise, vibration, electrical,
   software): NEVER recommend approve_replacement based on images alone.
   Photographs cannot prove a functional fault. Route to remote_troubleshooting,
   send_technician, or request_more_evidence.

D) Policy citation: every recommendation must cite at least one retrieved
   policy section in policy_analysis.relevant_sections, formatted as
   "<Policy Name> §<sectionRef>". If no policy chunks were retrieved, say so in
   policy_result and lower replacement_validity_score accordingly.

E) Contradictions: if the complaint claims something the evidence does not
   support (e.g. "photos attached showing damage" but no IMAGE block exists,
   or "broken door" but the IMAGE shows an intact door), list each
   inconsistency as a separate entry in contradictions[]. This is the most
   important field — managers rely on it to spot bad claims.

F) Verified facts vs uncertainties: a fact belongs in verified_facts ONLY if
   you observed it directly in an attached image or extracted PDF text, or it
   is in the structured CASE METADATA. Everything else (customer claims about
   dates, symptoms, etc.) goes in uncertainties.

G) Scoring (replacement_validity_score 0-100 integer):
   - 0-30   no/weak evidence, missing critical documents → reject_request /
            request_more_evidence
   - 31-50  weak claim or missing evidence              → request_more_evidence
   - 51-70  plausible issue, functional defect needing
            remote diagnosis                            → remote_troubleshooting /
                                                          send_technician
   - 71-85  strong evidence with partial docs           → escalate_manager
   - 86-100 clear defect + invoice within warranty +
            evidence supports claim                     → approve_replacement
   The score MUST be defensible against the actual evidence inspected. If
   nothing was attached, the score must be in 0-30.

H) Output: return ONLY valid JSON matching the schema. No prose, no markdown
   fences, no commentary.
`.trim();

export type UserPromptInput = {
  caseMetadata: Record<string, unknown>;
  complaintText: string;
  requestedAction: string;
  retrievedPolicy: { policyName: string; sectionRef: string; chunkText: string }[];
  productContext?: string;
  /** Counters injected into the prompt so the model knows exactly how much
   *  evidence it has before reading the attached parts. */
  evidenceCounts: { imageCount: number; pdfCount: number };
};

export function buildUserPrompt(input: UserPromptInput): string {
  const policyBlock =
    input.retrievedPolicy.length === 0
      ? "(no policy chunks retrieved — note this in policy_analysis.policy_result and lower the score accordingly)"
      : input.retrievedPolicy
          .map(
            (c, i) =>
              `[${i + 1}] ${c.policyName} §${c.sectionRef}\n${c.chunkText}`
          )
          .join("\n\n");

  const productBlock = input.productContext
    ? `PRODUCT DETAILS (catalogue REFERENCE — NOT verified invoice evidence; do NOT copy estimatedValueAed into document_analysis.product_value_aed):\n${input.productContext}\n\n`
    : "";

  const { imageCount, pdfCount } = input.evidenceCounts;
  const evidenceBanner = `EVIDENCE ATTACHED TO THIS CASE: ${imageCount} image(s), ${pdfCount} PDF document(s).${
    imageCount === 0
      ? " Because no image was attached, every visual_analysis field must reflect 'no image evidence' per rule A."
      : ""
  }${
    pdfCount === 0
      ? " Because no PDF was attached, every document_analysis field except status enums must be null per rule B."
      : ""
  }`;

  return `Analyze the following case.

${evidenceBanner}

CASE METADATA:
${JSON.stringify(input.caseMetadata, null, 2)}

${productBlock}CUSTOMER COMPLAINT:
"${input.complaintText}"

REQUESTED ACTION: ${input.requestedAction}

RETRIEVED POLICY CHUNKS:
${policyBlock}

Return a single JSON object with this exact schema (all fields required, use null only where the schema permits it):
{
  "case_summary": "one concise paragraph summarising the case",
  "complaint_analysis": {
    "category": "functional_issue | visible_damage | missing_accessory | installation_issue | cosmetic",
    "severity": "low | medium | high | critical",
    "clarity_score": <0-100 reflecting how specific/actionable the complaint text is>,
    "missing_evidence": ["list specific items still needed; empty array if none"]
  },
  "visual_analysis": {
    "visible_damage": <bool — only true if an attached IMAGE shows damage>,
    "damage_type": "scratch | dent | broken_part | leakage | packaging_damage | none_visible | unclear",
    "evidence_quality_score": <0-100; 0 if no image attached>,
    "serial_number_visible": <bool — only true if you see the serial on an image>,
    "claim_image_consistency": "supports_claim | does_not_support_claim | inconclusive",
    "visual_uncertainty": "describe what cannot be concluded from the images; if no image, start with 'No image evidence was provided'"
  },
  "document_analysis": {
    "invoice_valid": <true | false | null (null = no invoice text)>,
    "warranty_status": "active | expired | unknown",
    "return_window_status": "within | expired | unknown",
    "product_value_aed": <number from invoice, or null. NEVER copy the catalogue estimate.>,
    "extracted_fields": {
      "invoice_number": <string from invoice text, or null>,
      "customer_name": <string from invoice text, or null>,
      "product_model": <string from invoice text, or null>,
      "serial_number": <string from invoice/delivery, or null>,
      "invoice_date": <ISO date from invoice, or null>,
      "delivery_date": <ISO date from delivery note, or null>,
      "warranty_start_date": <ISO date, or null>,
      "warranty_end_date": <ISO date, or null>
    }
  },
  "policy_analysis": {
    "relevant_sections": ["<Policy Name> §<sectionRef>", "..."],
    "policy_result": "explanation of applicable policy outcome citing the retrieved chunks"
  },
  "contradictions": ["each claim-vs-evidence inconsistency"],
  "verified_facts": ["facts confirmed by attached evidence or CASE METADATA"],
  "uncertainties": ["customer claims that have not been verified"],
  "replacement_validity_score": <0-100 per rule G>,
  "recommended_action": "approve_replacement | reject_request | request_more_evidence | remote_troubleshooting | send_technician | escalate_manager",
  "manager_summary": "concise human-readable recommendation, no customer-blaming language"
}`;
}

export const REPAIR_INSTRUCTION =
  "Your previous response was not valid JSON matching the schema. Return ONLY valid JSON matching the schema. No prose. No markdown fences.";
