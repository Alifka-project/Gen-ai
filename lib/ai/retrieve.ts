// lib/ai/retrieve.ts
// pgvector cosine similarity over PolicyChunk.
// Brief §6.5.

import { prisma } from "@/lib/db/prisma";
import { embed } from "@/lib/ai/embeddings";

export type RetrievedChunk = {
  id: string;
  policyName: string;
  sectionRef: string;
  chunkText: string;
  score: number;
};

/**
 * Embed `query` and return the top-k most similar PolicyChunk rows by cosine.
 * pgvector's `<=>` operator is cosine distance; similarity = 1 - distance.
 */
export async function retrieveTopK(
  query: string,
  k = 5
): Promise<RetrievedChunk[]> {
  const [embedding] = await embed([query]);
  if (!embedding) return [];

  // pgvector wants a literal of the form '[0.1,0.2,...]'::vector
  const literal = `[${embedding.join(",")}]`;

  const rows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
    `SELECT id,
            "policyName",
            "sectionRef",
            "chunkText",
            (1 - (embedding <=> $1::vector))::float8 AS score
     FROM "PolicyChunk"
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    literal,
    k
  );

  return rows;
}
