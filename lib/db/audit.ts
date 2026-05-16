// lib/db/audit.ts
// Append-only audit-log helper. Proposal §14.1 (`audit_logs` table) and §21.2
// (audit logging security control). Failures here must NEVER block the main
// operation — we log and swallow.

import { prisma } from "@/lib/db/prisma";

export type AuditActor = "customer_service" | "manager" | "system";

export type AuditAction =
  | "case_created"
  | "document_uploaded"
  | "analysis_run"
  | "analysis_failed"
  | "decision_recorded"
  | "policies_reindexed";

export async function recordAudit(args: {
  caseId?: string | null;
  actor: AuditActor;
  action: AuditAction;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        caseId: args.caseId ?? null,
        actor: args.actor,
        action: args.action,
        details: (args.details ?? null) as unknown as object,
      },
    });
  } catch (e) {
    // Audit must not break the main flow.
    console.warn("[audit] failed to record:", e instanceof Error ? e.message : e);
  }
}
