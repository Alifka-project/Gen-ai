import { NextResponse } from "next/server";
import { indexAllPolicies } from "@/lib/ai/index-policies";
import { recordAudit } from "@/lib/db/audit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await indexAllPolicies();
    await recordAudit({
      actor: "system",
      action: "policies_reindexed",
      details: result,
    });
    return NextResponse.json(
      {
        filesProcessed: result.filesProcessed,
        chunksInserted: result.chunksInserted,
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
