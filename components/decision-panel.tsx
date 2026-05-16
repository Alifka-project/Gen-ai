"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RecommendationBadge } from "@/components/recommendation-badge";
import { getRole, type Role } from "@/components/role-switcher";

// Per Replacement Policy §3.1 Approval Matrix:
// approve + reject are manager-only; the rest can be initiated by CS staff.
const MANAGER_ONLY = new Set(["approve", "reject"]);

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
  const [role, setRole] = useState<Role>("customer_service");

  useEffect(() => {
    setRole(getRole());
    const onRoleChange = () => setRole(getRole());
    window.addEventListener("returnguard:role", onRoleChange);
    return () => window.removeEventListener("returnguard:role", onRoleChange);
  }, []);

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
    <Card className="p-6 space-y-5 border-slate-200">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Manager Decision</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            AI output is advisory. Choose the action you authorise as the responsible manager.
          </p>
        </div>
        {currentDecision && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Current:</span>
            <RecommendationBadge value={currentDecision} size="sm" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {DECISIONS.map((d) => {
          const disabled = role !== "manager" && MANAGER_ONLY.has(d.value);
          const isSelected = decision === d.value;
          return (
            <Button
              key={d.value}
              variant={isSelected ? "default" : d.variant}
              size="sm"
              onClick={() => setDecision(d.value)}
              type="button"
              disabled={disabled}
              title={disabled ? "Manager role required — switch role in the header." : undefined}
              className={isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""}
            >
              {d.label}
              {disabled ? " (manager only)" : ""}
            </Button>
          );
        })}
      </div>

      {role !== "manager" && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          You are acting as <strong>Customer Service</strong>. Approve / Reject
          require the manager role per Replacement Policy §3.1. Switch role in
          the header to unlock them.
        </p>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Manager Note (optional)</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Reason, customer-facing message, or any caveats for the audit log."
          className="resize-none"
        />
      </div>

      <div className="flex justify-end pt-1">
        <Button
          onClick={submit}
          disabled={
            saving ||
            !decision ||
            (role !== "manager" && MANAGER_ONLY.has(decision ?? ""))
          }
        >
          {saving ? "Saving…" : currentDecision ? "Update Decision" : "Submit Decision"}
        </Button>
      </div>
    </Card>
  );
}
