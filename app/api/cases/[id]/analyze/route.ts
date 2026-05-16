import { NextResponse } from "next/server";
import { analyzeCase } from "@/lib/ai/analyze";

// Allow longer execution since Gemini calls can take 10–30s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await analyzeCase(params.id);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
