-- ReturnGuard AI — initial schema
-- Hand-written to match prisma/schema.prisma (we could not run `prisma
-- migrate dev` from the build machine because outbound TCP 5432 was
-- blocked; the Neon HTTPS driver is used to apply this SQL via
-- scripts/apply-init-sql.ts).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "productModel" TEXT NOT NULL,
    "serialNumber" TEXT,
    "complaintText" TEXT NOT NULL,
    "requestedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extractedJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicyChunk" (
    "id" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "sectionRef" TEXT NOT NULL,
    "ruleType" TEXT,
    "chunkText" TEXT NOT NULL,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "replacementValidityScore" INTEGER NOT NULL,
    "recommendation" TEXT NOT NULL,
    "retrievedChunks" JSONB NOT NULL,
    "explanationJson" JSONB NOT NULL,
    "rawOutput" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagerDecision" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "managerNote" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManagerDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAnalysis_caseId_key" ON "AiAnalysis"("caseId");
CREATE UNIQUE INDEX "ManagerDecision_caseId_key" ON "ManagerDecision"("caseId");
CREATE INDEX "Document_caseId_idx" ON "Document"("caseId");
CREATE INDEX "PolicyChunk_policyName_idx" ON "PolicyChunk"("policyName");
CREATE INDEX "AuditLog_caseId_idx" ON "AuditLog"("caseId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagerDecision" ADD CONSTRAINT "ManagerDecision_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
