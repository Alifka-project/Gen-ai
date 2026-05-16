// scripts/index-policies.ts
// CLI wrapper for the shared policy-indexing logic.
// Run with: pnpm tsx scripts/index-policies.ts

import "dotenv/config";
import { indexAllPolicies, POLICIES_DIR } from "../lib/ai/index-policies";
import { prisma } from "../lib/db/prisma";

async function main() {
  console.log(`→ Reading policy files from ${POLICIES_DIR}`);
  const { filesProcessed, chunksInserted } = await indexAllPolicies();
  console.log(`✓ Processed ${filesProcessed} file(s), inserted ${chunksInserted} chunk(s).`);
}

main()
  .catch((e) => {
    console.error("✗ index-policies failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
