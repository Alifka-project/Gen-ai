// lib/ai/embeddings.ts
// OpenAI text-embedding-3-small with 768 dimensions to match pgvector(768).

import OpenAI from "openai";

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export const EMBEDDING_DIMS = 768;

function requireKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env / .env.local before calling embed()."
    );
  }
  return key;
}

/**
 * Embed an array of texts. Returns one 768-dim vector per input.
 * Uses OpenAI text-embedding-3-small with dimension truncation.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openai = new OpenAI({ apiKey: requireKey() });

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMS,
  });

  // Sort by index to preserve input order
  const sorted = response.data.sort((a, b) => a.index - b.index);
  return sorted.map((item) => item.embedding);
}
