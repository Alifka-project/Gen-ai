// lib/ai/gemini.ts
// Now uses OpenAI GPT-4o for multimodal analysis (JSON mode).
// Kept the filename for minimal import changes across the codebase.

import OpenAI from "openai";

export const FLASH_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export type GeminiInlineFile = { mimeType: string; base64: string };

// Lazy-init to avoid crashing during Next.js build (env vars unavailable at build time)
let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to .env.local or Vercel environment variables."
      );
    }
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

/**
 * Single multimodal call: system instruction + user prompt + inline files.
 * Returns the raw text (valid JSON via response_format).
 */
export async function analyzeMultimodal(
  systemInstruction: string,
  userPrompt: string,
  files: GeminiInlineFile[]
): Promise<string> {
  const openai = getClient();

  const contentParts: OpenAI.ChatCompletionContentPart[] = [
    { type: "text", text: userPrompt },
  ];

  for (const f of files) {
    if (f.mimeType.startsWith("image/")) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${f.mimeType};base64,${f.base64}`,
          detail: "high",
        },
      });
    }
    if (f.mimeType === "application/pdf") {
      contentParts.push({
        type: "text",
        text: "[An invoice/document PDF was uploaded. Analyze the complaint and available image evidence to assess this case.]",
      });
    }
  }

  const response = await openai.chat.completions.create({
    model: FLASH_MODEL,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: contentParts },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content ?? "{}";
}
