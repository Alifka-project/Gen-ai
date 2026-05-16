// lib/ai/prompts.ts
// Master system prompt + user prompt builder. Brief §6.1.

export const SYSTEM_PROMPT = `
You are ReturnGuard AI, a decision-support assistant for product return and replacement validation.
You DO NOT make final approval decisions. You analyze evidence and recommend the next action for a human manager.

Hard rules:
1. Use ONLY the provided evidence and retrieved policy. Never invent facts.
2. Separate verified_facts from assumptions and uncertainties.
3. If the complaint is a FUNCTIONAL defect (noise, vibration, not heating/cooling, software error, electrical),
   photos alone CANNOT prove the defect. You MUST recommend "remote_troubleshooting", "send_technician",
   or "request_more_evidence" — never "approve_replacement" based on photos alone for functional claims.
4. For each policy rule you apply, cite its sectionRef in policy_analysis.relevant_sections
   (format the entry as "<Policy Name> §<sectionRef>"). At least one citation is required.
5. If the complaint text contradicts the visual evidence or the document evidence, list each
   inconsistency as a separate string in "contradictions".
6. Return ONLY valid JSON matching the schema. No prose outside the JSON object. No markdown fences.

SCORING GUIDANCE for replacement_validity_score (0-100 integer):
- 0-30: Insufficient evidence or clear policy violation → reject_request / request_more_evidence
- 31-50: Weak claim, missing critical documents → request_more_evidence
- 51-70: Plausible issue, functional defect → remote_troubleshooting / send_technician
- 71-85: Strong case with documentation, likely valid → escalate_manager / approve_replacement
- 86-100: Clear defect, full documentation, within warranty → approve_replacement
Score MUST reflect the actual evidence quality, document completeness, and policy compliance.
Do NOT default to 0. Assign a meaningful score based on your analysis.
`.trim();

export type UserPromptInput = {
  caseMetadata: Record<string, unknown>;
  complaintText: string;
  requestedAction: string;
  retrievedPolicy: { policyName: string; sectionRef: string; chunkText: string }[];
  productContext?: string; // optional — catalogue-grounded product details
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
    ? `PRODUCT DETAILS (from company catalogue — authoritative; use these instead of guessing):\n${input.productContext}\n\n`
    : "";

  return `Analyze the following case.

CASE METADATA:
${JSON.stringify(input.caseMetadata, null, 2)}

${productBlock}CUSTOMER COMPLAINT:
"${input.complaintText}"

REQUESTED ACTION: ${input.requestedAction}

UPLOADED FILES: [images and any invoice/PDF are attached as inline parts after this text]

RETRIEVED POLICY CHUNKS:
${policyBlock}

Return a single JSON object with this exact schema (all fields required, use null only where the schema permits it):
{
  "case_summary": "one concise paragraph summarising the case",
  "complaint_analysis": {
    "category": "functional_issue OR visible_damage OR missing_accessory OR installation_issue OR cosmetic",
    "severity": "low OR medium OR high OR critical",
    "clarity_score": 75,
    "missing_evidence": ["list items if any, else empty array"]
  },
  "visual_analysis": {
    "visible_damage": false,
    "damage_type": "scratch OR dent OR broken_part OR leakage OR packaging_damage OR none_visible OR unclear",
    "evidence_quality_score": 60,
    "serial_number_visible": false,
    "claim_image_consistency": "supports_claim OR does_not_support_claim OR inconclusive",
    "visual_uncertainty": "describe any visual uncertainty, or empty string if none"
  },
  "document_analysis": {
    "invoice_valid": null,
    "warranty_status": "active OR expired OR unknown",
    "return_window_status": "within OR expired OR unknown",
    "product_value_aed": null,
    "extracted_fields": {
      "invoice_number": null,
      "customer_name": null,
      "product_model": null,
      "serial_number": null,
      "invoice_date": null,
      "delivery_date": null,
      "warranty_start_date": null,
      "warranty_end_date": null
    }
  },
  "policy_analysis": {
    "relevant_sections": ["Policy Name §sectionRef"],
    "policy_result": "explanation of applicable policy outcome"
  },
  "contradictions": ["list contradictions if any, else empty array"],
  "verified_facts": ["list facts confirmed by evidence"],
  "uncertainties": ["list uncertainties if any"],
  "replacement_validity_score": 55,
  "recommended_action": "approve_replacement OR reject_request OR request_more_evidence OR remote_troubleshooting OR send_technician OR escalate_manager",
  "manager_summary": "concise human-readable recommendation, no customer-blaming language"
}

IMPORTANT: The numeric values (clarity_score, evidence_quality_score, replacement_validity_score) shown above (75, 60, 55) are EXAMPLES ONLY. Replace them with your actual assessed values based on the evidence. Do NOT copy example values verbatim.`;
}

export const REPAIR_INSTRUCTION =
  "Your previous response was not valid JSON matching the schema. Return ONLY valid JSON matching the schema. No prose. No markdown fences.";
