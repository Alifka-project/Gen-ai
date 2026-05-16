"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RecommendationBadge } from "@/components/recommendation-badge";

const DECISIONS: { value: string; label: string; variant: "default" | "destructive" | "outline" | "secondary" }[] = [
  { value: "approve", label: "Approve", variant: "default" },
  { value: "reject", label: "Reject", variant: "destructive" },
  { value: "request_evidence", label: "Request evidence", variant: "outline" },
  { value: "remote_troubleshoot", label: "Remote troubleshoot", variant: "outline" },
  { value: "send_technician", label: "Send technician", variant: "outline" },
  { value: "escalate", label: "Escalate", variant: "secondary" },
];

export function DecisionPanel({
  caseId,
  currentDecision,
  currentNote,
}: {
  caseId: string;
  currentDecision: string | null;
  currentNote: string | null;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<string | null>(currentDecision);
  const [note, setNote] = useState<string>(currentNote ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!decision) {
      toast.error("Pick a decision first.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, managerNote: note || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `save failed: ${res.status}`);
      }
      toast.success("Decision recorded.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Manager decision</h2>
          <p className="text-sm text-muted-foreground">
            The AI output above is advisory. Choose the action you authorise as the manager.
          </p>
        </div>
        {currentDecision ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Current:</span>
            <RecommendationBadge value={currentDecision} size="sm" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {DECISIONS.map((d) => (
          <Button
            key={d.value}
            variant={decision === d.value ? "default" : d.variant}
            onClick={() => setDecision(d.value)}
            type="button"
          >
            {d.label}
          </Button>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium">Manager note (optional)</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Reason, customer-facing message, or any caveats for the audit log."
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving || !decision}>
          {saving ? "Saving..." : currentDecision ? "Update decision" : "Submit decision"}
        </Button>
      </div>
    </Card>
  );
}
