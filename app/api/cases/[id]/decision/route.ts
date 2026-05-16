import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  decision: z.enum([
    "approve",
    "reject",
    "request_evidence",
    "remote_troubleshoot",
    "send_technician",
    "escalate",
  ]),
  managerNote: z.string().max(2000).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const caseExists = await prisma.case.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!caseExists) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const dec = await prisma.managerDecision.upsert({
    where: { caseId: params.id },
    update: {
      decision: parsed.data.decision,
      managerNote: parsed.data.managerNote ?? null,
      decidedAt: new Date(),
    },
    create: {
      caseId: params.id,
      decision: parsed.data.decision,
      managerNote: parsed.data.managerNote ?? null,
    },
  });

  await prisma.case.update({
    where: { id: params.id },
    data: { status: "decided" },
  });

  await recordAudit({
    caseId: params.id,
    actor: "manager",
    action: "decision_recorded",
    details: {
      decision: parsed.data.decision,
      hasNote: !!parsed.data.managerNote,
    },
  });

  return NextResponse.json(
    { id: dec.id, decidedAt: dec.decidedAt },
    { status: 200 }
  );
}
