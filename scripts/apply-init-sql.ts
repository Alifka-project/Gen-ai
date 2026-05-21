// scripts/apply-init-sql.ts
// One-time bootstrap: apply prisma/migrations/20260516170000_init/migration.sql
// via the Neon HTTPS driver. Use this when `pnpm prisma migrate deploy` is
// blocked (e.g. outbound TCP 5432 firewalled).
//
// Run with: pnpm tsx scripts/apply-init-sql.ts
//
// Idempotent in spirit: the migration uses CREATE EXTENSION IF NOT EXISTS
// for vector, but the CREATE TABLE statements will error if tables already
// exist — that's intentional, so we don't silently re-create over a populated
// database. Use scripts/reset-db.ts (if you need to wipe + replay).

import { config } from "dotenv"; config({ override: true });
import { promises as fs } from "node:fs";
import path from "node:path";
import { neon, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { randomUUID, createHash } from "node:crypto";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const MIGRATION_DIR = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260516170000_init"
);
const MIGRATION_FILE = path.join(MIGRATION_DIR, "migration.sql");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  console.log("→ Reading migration SQL...");
  const migrationSql = await fs.readFile(MIGRATION_FILE, "utf8");

  // Strip line comments so the simple split-on-semicolon below doesn't
  // misparse "-- ;" inside comments.
  const stripped = migrationSql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  const statements = stripped
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`→ Found ${statements.length} statement(s) to apply.`);

  const sql = neon(url);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
    try {
      await sql.query(stmt);
      console.log("ok");
    } catch (e) {
      console.log("ERR");
      throw e;
    }
  }

  console.log("→ Recording migration in _prisma_migrations...");
  await sql.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  )`);

  const checksum = createHash("sha256").update(migrationSql).digest("hex");
  const existing = (await sql.query(
    `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1`,
    ["20260516170000_init"]
  )) as Array<{ id: string }>;

  if (existing.length === 0) {
    await sql.query(
      `INSERT INTO "_prisma_migrations"
       ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, 1)`,
      [randomUUID(), checksum, "20260516170000_init"]
    );
    console.log("  recorded.");
  } else {
    console.log("  already recorded.");
  }

  console.log("✓ Migration applied.");
}

main().catch((e) => {
  console.error("✗ apply-init-sql failed:", e);
  process.exit(1);
});
