import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const c = await prisma.case.findUnique({
    where: { id: params.id },
    include: { documents: true, analysis: true, decision: true },
  });
  if (!c) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }
  return NextResponse.json(c);
}
