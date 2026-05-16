// lib/ai/embeddings.ts
// Wrapper over Google's text-embedding endpoint.
//
// Uses direct fetch instead of the @google/generative-ai SDK because:
//  (a) we need outputDimensionality (Matryoshka truncation to 768),
//  (b) Google retired text-embedding-004 — we now use gemini-embedding-001,
//      which defaults to 3072 dims; we truncate to 768 to match the
//      Prisma schema's vector(768) column.
//
// Override the model with GEMINI_EMBEDDING_MODEL if needed.

const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

export const EMBEDDING_DIMS = 768;

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;

function requireKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env / .env.local before calling embed()."
    );
  }
  return key;
}

async function embedOne(text: string): Promise<number[]> {
  const apiKey = requireKey();
  const res = await fetch(ENDPOINT(EMBEDDING_MODEL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMS,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `embedContent failed (${res.status}) for model ${EMBEDDING_MODEL}: ${body}`
    );
  }
  const data = (await res.json()) as {
    embedding?: { values?: number[] };
    error?: { message?: string };
  };
  const values = data.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error(
      `embedContent returned no values: ${data.error?.message ?? JSON.stringify(data)}`
    );
  }
  return values;
}

/**
 * Embed an array of texts. Returns one vector per input.
 * Free-tier rate limits are ~150 requests/min on gemini-embedding-001,
 * so chunked Promise.all is fine for our 9 policy chunks.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return Promise.all(texts.map(embedOne));
}
