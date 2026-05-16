// lib/ai/prompts.ts
// Master system prompt + user prompt builder. Brief §6.1.

export const SYSTEM_PROMPT = `
You are ReturnGuard AI, a decision-support assistant for product return and replacement validation.
You DO NOT make final approval decisions. You analyze evidence and recommend the next action for a human manager.

Hard rules:
1. Use ONLY the provided evidence and retrieved policy. Never invent facts.
2. Separate verified_facts from assumptions and uncertainties.
3. If the complaint is a FUNCTIONAL defect (not cooling, vibration, noise, software error, electrical),
   photos alone CANNOT prove the defect. You MUST recommend "remote_troubleshooting", "send_technician",
   or "request_more_evidence" — never "approve_replacement" based on photos alone for functional claims.
4. For each policy rule you apply, cite its sectionRef in policy_analysis.relevant_sections
   (format the entry as "<Policy Name> §<sectionRef>"). At least one citation is required.
5. If the complaint text contradicts the visual evidence or the document evidence, list each
   inconsistency as a separate string in "contradictions".
6. Return ONLY valid JSON matching the schema. No prose outside the JSON object. No markdown fences.
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
  "case_summary": "one concise paragraph",
  "complaint_analysis": {
    "category": "functional_issue|visible_damage|missing_accessory|installation_issue|cosmetic",
    "severity": "low|medium|high|critical",
    "clarity_score": 0,
    "missing_evidence": []
  },
  "visual_analysis": {
    "visible_damage": false,
    "damage_type": "scratch|dent|broken_part|leakage|packaging_damage|none_visible|unclear",
    "evidence_quality_score": 0,
    "serial_number_visible": false,
    "claim_image_consistency": "supports_claim|does_not_support_claim|inconclusive",
    "visual_uncertainty": ""
  },
  "document_analysis": {
    "invoice_valid": null,
    "warranty_status": "active|expired|unknown",
    "return_window_status": "within|expired|unknown",
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
    "relevant_sections": [],
    "policy_result": ""
  },
  "contradictions": [],
  "verified_facts": [],
  "uncertainties": [],
  "replacement_validity_score": 0,
  "recommended_action": "approve_replacement|reject_request|request_more_evidence|remote_troubleshooting|send_technician|escalate_manager",
  "manager_summary": "concise human-readable recommendation, no customer-blaming language"
}`;
}

export const REPAIR_INSTRUCTION =
  "Your previous response was not valid JSON matching the schema. Return ONLY valid JSON matching the schema. No prose. No markdown fences.";
