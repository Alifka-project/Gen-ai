import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const createCaseSchema = z.object({
  customerName: z.string().min(1).max(200),
  productModel: z.string().min(1).max(200),
  serialNumber: z.string().max(200).nullable().optional(),
  complaintText: z.string().min(1).max(4000),
  requestedAction: z.enum(["replacement", "refund", "repair"]),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const created = await prisma.case.create({
    data: {
      customerName: parsed.data.customerName,
      productModel: parsed.data.productModel,
      serialNumber: parsed.data.serialNumber ?? null,
      complaintText: parsed.data.complaintText,
      requestedAction: parsed.data.requestedAction,
    },
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}

export async function GET() {
  const cases = await prisma.case.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      analysis: {
        select: {
          recommendation: true,
          replacementValidityScore: true,
        },
      },
      decision: { select: { decision: true } },
      _count: { select: { documents: true } },
    },
  });
  return NextResponse.json({ cases });
}
