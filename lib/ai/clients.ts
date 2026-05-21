// lib/ai/clients.ts
// Lazy factories for both AI providers — Anthropic (Claude) and OpenAI (GPT).
// Explicit baseURL + apiKey to avoid clashes with shell-injected env vars
// (e.g. Claude Code sets ANTHROPIC_API_KEY="" and ANTHROPIC_BASE_URL=... for
// its own tooling, which would silently break our SDK calls).

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

export function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 20) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set or invalid. Add it to .env.local (or Vercel env vars)."
    );
  }
  _anthropic = new Anthropic({
    apiKey,
    baseURL: "https://api.anthropic.com",
  });
  return _anthropic;
}

export function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.length < 20) {
    throw new Error(
      "OPENAI_API_KEY is not set or invalid. Add it to .env.local (or Vercel env vars)."
    );
  }
  _openai = new OpenAI({ apiKey });
  return _openai;
}

// ─── Model registry ──────────────────────────────────────────────────────
// Picked per task for the right price/perf/capability tradeoff.

export const MODELS = {
  GPT_4O: process.env.OPENAI_MODEL ?? "gpt-4o",
  GPT_4O_MINI: process.env.OPENAI_MINI_MODEL ?? "gpt-4o-mini",
  CLAUDE_SONNET: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
  CLAUDE_HAIKU: process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-4-5",
} as const;

/** Agent → model mapping. Each AI agent in the pipeline picks the model best
 *  suited to its task. Changing a single mapping reroutes that agent without
 *  touching call sites. */
export const AGENT_MODELS = {
  // Module A (Complaint Classifier) — cheap, fast classification task
  complaintClassifier: MODELS.GPT_4O_MINI,
  // Module B (Vision Inspector) — Claude Sonnet 4.5 has strong vision
  visionInspector: MODELS.CLAUDE_SONNET,
  // Module C (Document Extractor) — Claude reads PDFs natively, strong at structured extraction
  documentExtractor: MODELS.CLAUDE_SONNET,
  // Module E (Reasoning Synthesizer) — Claude Sonnet 4.5 = best fused reasoning
  reasoningSynthesizer: MODELS.CLAUDE_SONNET,
  // Primary analyzer (existing single-pass path, GPT-4o vision)
  primaryAnalyzer: MODELS.GPT_4O,
  // Second-opinion analyzer (different family for cross-model agreement check)
  secondaryAnalyzer: MODELS.CLAUDE_SONNET,
  // Critic — independent verifier of primary; uses the OTHER family to avoid
  //   shared blind spots
  critic: MODELS.GPT_4O,
} as const;
