"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AnalyzeButton({
  caseId,
  hasAnalysis,
  status,
}: {
  caseId: string;
  hasAnalysis: boolean;
  status?: string;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const toastId = toast.loading("Running multimodal analysis...");
    try {
      const res = await fetch(`/api/cases/${caseId}/analyze`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `analyze failed: ${res.status}`);
      }
      const body = await res.json();
      toast.success(
        `Analysis complete (${body.latencyMs}ms, RVS ${body.analysis.replacement_validity_score}).`,
        { id: toastId }
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "analyze failed", { id: toastId });
    } finally {
      setRunning(false);
    }
  }

  const isStuck = status === "analyzing" && !running;
  const label = running
    ? "Analyzing..."
    : isStuck
    ? "Retry analysis"
    : hasAnalysis
    ? "Re-run analysis"
    : "Run analysis";

  return (
    <div className="space-y-1">
      <Button onClick={run} disabled={running} variant={hasAnalysis ? "outline" : "default"}>
        {label}
      </Button>
      {isStuck && (
        <p className="text-[10px] text-amber-600">
          Previous analysis failed. Click to retry.
        </p>
      )}
    </div>
  );
}
