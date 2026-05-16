// lib/ai/embeddings.ts
// Thin wrapper over Google text-embedding-004 (768 dims, free tier).

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && process.env.NODE_ENV !== "test") {
  // Lazy warning — don't crash module load; embed() will throw if actually called.
  console.warn(
    "[embeddings] GEMINI_API_KEY is not set; embed() calls will fail."
  );
}

const genAI = new GoogleGenerativeAI(apiKey ?? "");
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

export const EMBEDDING_DIMS = 768;

/**
 * Embed an array of texts. Returns one vector per input.
 * Uses batchEmbedContents when >1 input for efficiency.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (texts.length === 1) {
    const result = await model.embedContent(texts[0]);
    return [result.embedding.values];
  }

  const result = await model.batchEmbedContents({
    requests: texts.map((text) => ({
      content: { role: "user", parts: [{ text }] },
    })),
  });
  return result.embeddings.map((e) => e.values);
}
