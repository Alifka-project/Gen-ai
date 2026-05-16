// lib/ai/gemini.ts
// Thin wrapper over Google Gemini multimodal Flash, JSON mode.
// Brief §6.2.

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn(
    "[gemini] GEMINI_API_KEY is not set; Gemini calls will fail at runtime."
  );
}

// Brief locks "Google Gemini 2.0 Flash". 2.0-flash remains valid; allow
// override via env so we can roll forward to 2.5-flash without code changes.
export const FLASH_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

export const genAI = new GoogleGenerativeAI(apiKey ?? "");

export const flashJson = genAI.getGenerativeModel({
  model: FLASH_MODEL,
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.2,
  },
});

export type GeminiInlineFile = { mimeType: string; base64: string };

/**
 * Single multimodal call: system instruction + user prompt + inline files.
 * Returns the raw text (which should be valid JSON when responseMimeType is set).
 */
export async function analyzeMultimodal(
  systemInstruction: string,
  userPrompt: string,
  files: GeminiInlineFile[]
): Promise<string> {
  const result = await flashJson.generateContent({
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    contents: [
      {
        role: "user",
        parts: [
          { text: userPrompt },
          ...files.map((f) => ({
            inlineData: { mimeType: f.mimeType, data: f.base64 },
          })),
        ],
      },
    ],
  });
  return result.response.text();
}
