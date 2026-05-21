// lib/ai/critic.ts
// Independent cross-model critic. Takes the PRIMARY analyzer's output and asks
// a different-family model to review it. Catches blind spots one family has
// (e.g. GPT overconfidence on functional defects, Claude over-conservatism
// on document evidence) by running the second-opinion check through the
// opposite family.
//
// The critic does NOT replace the primary recommendation — it produces a
// short critique + a numeric confidence score that the manager UI displays
// next to the primary recommendation.

import { getOpenAI, MODELS } from "./clients";
import { z } from "zod";
import type { AiAnalysisJson } from "./schema";

const CRITIC_MODEL = MODELS.GPT_4O;

export const criticVerdictSchema = z.object({
  agrees_with_primary: z.boolean(),
  confidence: z.number().min(0).max(100),
  disputed_fields: z.array(z.string()),
  critique: z.string().min(1),
  alternate_recommendation: z
    .enum([
      "approve_replacement",
      "reject_request",
      "request_more_evidence",
      "remote_troubleshooting",
      "send_technician",
      "escalate_manager",
    ])
    .nullable(),
  model_used: z.string(),
});

export type CriticVerdict = z.infer<typeof criticVerdictSchema>;

const CRITIC_SYSTEM = `
You are an independent senior reviewer for return-validation AI outputs. You
were trained by a DIFFERENT vendor than the primary analyzer, on purpose, so
your job is to catch blind spots and silent errors.

Given the case context AND the primary analyzer's structured output, return a
single JSON object with this shape:

{
  "agrees_with_primary": <bool>,
  "confidence": <integer 0-100; how confident YOU are in the primary's recommended_action given the evidence>,
  "disputed_fields": ["dot.path", ...],     // fields where your judgement differs
  "critique": "<2-4 sentences. Cite specific evidence (or missing evidence). Be terse.>",
  "alternate_recommendation": "<one of the 6 action enums, OR null if you fully agree>"
}

Rules:
- You see exactly the same evidence summary as the primary; do NOT invent new evidence.
- If the primary's reasoning is sound, agrees_with_primary=true, confidence high, disputed_fields=[], alternate_recommendation=null.
- Functional defects (cooling, vibration, electrical) cannot be approved on images alone — flag this if primary did.
- If the primary set product_value_aed without an actual invoice extraction, flag it.
- Output JSON ONLY — no prose outside the object.
`.trim();

export async function runCritic(args: {
  productModel: string;
  complaintText: string;
  evidenceSummary: {
    imageCount: number;
    pdfCount: number;
    pdfCharsExtracted: number;
    policyChunksRetrieved: number;
  };
  primaryAnalysis: AiAnalysisJson;
  primaryModel: string;
}): Promise<CriticVerdict> {
  const client = getOpenAI();

  const userPrompt = `CASE
  product: ${args.productModel}
  complaint: "${args.complaintText.slice(0, 1000)}"
  evidence: ${JSON.stringify(args.evidenceSummary)}

PRIMARY MODEL: ${args.primaryModel}

PRIMARY OUTPUT:
${JSON.stringify(
  {
    recommended_action: args.primaryAnalysis.recommended_action,
    replacement_validity_score: args.primaryAnalysis.replacement_validity_score,
    complaint_analysis: args.primaryAnalysis.complaint_analysis,
    visual_analysis: args.primaryAnalysis.visual_analysis,
    document_analysis: args.primaryAnalysis.document_analysis,
    policy_analysis: args.primaryAnalysis.policy_analysis,
    contradictions: args.primaryAnalysis.contradictions,
    manager_summary: args.primaryAnalysis.manager_summary,
  },
  null,
  2
)}

Return your critic JSON now.`;

  const response = await client.chat.completions.create({
    model: CRITIC_MODEL,
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 1024,
    messages: [
      { role: "system", content: CRITIC_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  // Best-effort parse — if the critic's output doesn't validate, fall back to
  // a neutral verdict so we never block the primary recommendation.
  const result = criticVerdictSchema.safeParse({
    ...(parsed as Record<string, unknown>),
    model_used: CRITIC_MODEL,
  });

  if (result.success) return result.data;

  return {
    agrees_with_primary: true,
    confidence: 50,
    disputed_fields: [],
    critique: `Critic output did not validate against schema; falling back to neutral. Raw: ${raw.slice(0, 200)}`,
    alternate_recommendation: null,
    model_used: CRITIC_MODEL,
  };
}
