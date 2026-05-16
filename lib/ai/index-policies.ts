// lib/ai/index-policies.ts
// Shared policy-indexing logic — called both by scripts/index-policies.ts (CLI)
// and by app/api/policies/reindex/route.ts (HTTP admin endpoint).

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { embed } from "@/lib/ai/embeddings";

type Chunk = {
  policyName: string;
  sectionRef: string;
  chunkText: string;
  ruleType: string | null;
};

export const POLICIES_DIR = path.join(process.cwd(), "data", "policies");

function inferRuleType(policyName: string, sectionRef: string): string | null {
  const key = `${policyName} §${sectionRef}`;
  const map: Record<string, string> = {
    "Return Policy §1": "return_window",
    "Return Policy §2": "damage_rule",
    "Return Policy §3": "open_box_depreciation",
    "Replacement Policy §1": "replacement_eligibility",
    "Replacement Policy §2": "technician_required",
    "Replacement Policy §3": "approval_matrix",
    "Warranty Policy §1": "warranty_coverage",
    "Warranty Policy §2": "warranty_exclusion",
    "Warranty Policy §3": "functional_fault_process",
  };
  return map[key] ?? null;
}

export function parsePolicyFile(filename: string, contents: string): Chunk[] {
  const titleMatch = contents.match(/^#\s+(.+?)\s*$/m);
  const title = titleMatch ? titleMatch[1] : filename;
  const policyName = title.split("—")[0].trim();

  const sectionRegex = /^##\s+§(\S+)\s+—\s+(.+?)\s*$/gm;
  const matches: { idx: number; ref: string; heading: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(contents)) !== null) {
    matches.push({ idx: m.index, ref: m[1], heading: m[2] });
  }

  const chunks: Chunk[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i + 1 < matches.length ? matches[i + 1].idx : contents.length;
    const body = contents.slice(start, end).trim();
    const sectionRef = matches[i].ref;
    const chunkText = `# ${policyName} §${sectionRef} — ${matches[i].heading}\n\n${body
      .replace(/^##\s+§\S+\s+—\s+.+?\s*$/m, "")
      .trim()}`;
    chunks.push({
      policyName,
      sectionRef,
      chunkText,
      ruleType: inferRuleType(policyName, sectionRef),
    });
  }
  return chunks;
}

function newCuid(): string {
  return "c" + randomUUID().replace(/-/g, "").slice(0, 24);
}

export async function indexAllPolicies(): Promise<{
  filesProcessed: number;
  chunksInserted: number;
}> {
  const files = (await fs.readdir(POLICIES_DIR)).filter((f) =>
    f.endsWith(".md")
  );

  const allChunks: Chunk[] = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(POLICIES_DIR, file), "utf8");
    allChunks.push(...parsePolicyFile(file, raw));
  }

  if (allChunks.length === 0) {
    return { filesProcessed: files.length, chunksInserted: 0 };
  }

  const vectors = await embed(allChunks.map((c) => c.chunkText));

  await prisma.policyChunk.deleteMany({});

  let inserted = 0;
  for (let i = 0; i < allChunks.length; i++) {
    const c = allChunks[i];
    const v = vectors[i];
    if (!v) continue;
    const literal = `[${v.join(",")}]`;
    const id = newCuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PolicyChunk"
         ("id", "policyName", "sectionRef", "ruleType", "chunkText", "embedding", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())`,
      id,
      c.policyName,
      c.sectionRef,
      c.ruleType,
      c.chunkText,
      literal
    );
    inserted++;
  }

  return { filesProcessed: files.length, chunksInserted: inserted };
}
