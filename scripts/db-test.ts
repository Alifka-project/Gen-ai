// scripts/db-test.ts
// Sanity check: insert one Case row, read it back, delete it.
// Run with: pnpm tsx scripts/db-test.ts
// Requires DATABASE_URL in .env (Neon Postgres with pgvector enabled).

import { config } from "dotenv"; config({ override: true });
import { prisma } from "../lib/db/prisma";

async function main() {
  console.log("→ Inserting test case...");
  const created = await prisma.case.create({
    data: {
      customerName: "DB Test User",
      productModel: "TEST-MODEL-001",
      complaintText: "This is a database connectivity test row.",
      requestedAction: "replacement",
    },
  });
  console.log("  inserted:", created.id);

  console.log("→ Reading it back...");
  const read = await prisma.case.findUnique({ where: { id: created.id } });
  console.log("  read:", read?.customerName, read?.requestedAction);

  console.log("→ Cleaning up...");
  await prisma.case.delete({ where: { id: created.id } });
  console.log("  deleted.");

  console.log("✓ DB roundtrip OK.");
}

main()
  .catch((e) => {
    console.error("✗ DB test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
