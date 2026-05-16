"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Brain, Shield, Eye, FileText, Cpu, FileCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type RetrievedChunk = {
  policyName: string;
  sectionRef: string;
  score: number;
};

type AiInsightProps = {
  caseId: string;
  customerName: string;
  score: number;
  managerSummary: string;
  clarityScore?: number;
  evidenceQuality?: number;
  retrievedChunks?: RetrievedChunk[];
  verifiedFacts?: string[];
  uncertainties?: string[];
  contradictions?: string[];
  complaintCategory?: string;
  severity?: string;
  modelUsed?: string;
  latencyMs?: number;
  // Visual analysis
  visibleDamage?: boolean;
  damageType?: string;
  claimImageConsistency?: string;
  serialNumberVisible?: boolean;
  // Document analysis
  invoiceValid?: boolean | null;
  warrantyStatus?: string;
  returnWindowStatus?: string;
  productValueAed?: number | null;
  // Policy
  relevantSections?: string[];
  policyResult?: string;
};

const RVS_WEIGHTS = [
  { label: "Complaint Clarity", weight: "20%", field: "clarityScore" },
  { label: "Evidence Quality", weight: "20%", field: "evidenceQuality" },
  { label: "Document Eligibility", weight: "25%", field: "docEligibility" },
  { label: "Policy Compliance", weight: "25%", field: "policyScore" },
  { label: "Historical Context", weight: "10%", field: "context" },
];

export function CaseAiInsight({
  caseId,
  customerName,
  score,
  managerSummary,
  clarityScore,
  evidenceQuality,
  retrievedChunks = [],
  verifiedFacts = [],
  uncertainties = [],
  contradictions = [],
  complaintCategory,
  severity,
  modelUsed = "gemini-2.0-flash",
  latencyMs,
  visibleDamage,
  damageType,
  claimImageConsistency,
  serialNumberVisible,
  invoiceValid,
  warrantyStatus,
  returnWindowStatus,
  productValueAed,
  relevantSections = [],
  policyResult,
}: AiInsightProps) {
  const [open, setOpen] = useState(false);

  const scoreColor =
    score >= 70
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : score >= 45
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-blue-100">
            <Brain className="size-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              AI Assessment — {customerName}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">{caseId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn("px-2 py-0.5 rounded-full border text-xs font-bold tabular-nums", scoreColor)}>
            RVS {score}/100
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {open ? "Hide" : "Expand"}
            {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </div>
      </div>

      {/* Always-visible summary */}
      <div className="px-4 py-3">
        <p className="text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-800">AI Summary: </span>
          {managerSummary}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {complaintCategory && (
            <Chip label={`Category: ${complaintCategory.replace(/_/g, " ")}`} color="slate" />
          )}
          {severity && (
            <Chip
              label={`Severity: ${severity}`}
              color={
                severity === "critical" || severity === "high" ? "red" : severity === "medium" ? "amber" : "slate"
              }
            />
          )}
          {damageType && damageType !== "none_visible" && (
            <Chip label={`Damage: ${damageType.replace(/_/g, " ")}`} color="red" />
          )}
          {warrantyStatus && (
            <Chip
              label={`Warranty: ${warrantyStatus}`}
              color={warrantyStatus === "active" ? "emerald" : warrantyStatus === "expired" ? "red" : "slate"}
            />
          )}
          {modelUsed && <Chip label={modelUsed} color="blue" />}
          {latencyMs && <Chip label={`${latencyMs}ms`} color="slate" />}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {/* Method explanation */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Cpu className="size-3.5" />} label="AI Method & Pipeline" />
            <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-1.5">
              {[
                "1. Complaint Text",
                "2. RAG Retrieval (pgvector)",
                "3. Multimodal Gemini 2.0 Flash",
                "4. Zod Validation",
                "5. RVS Scoring",
              ].map((step, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-blue-50 rounded px-2 py-1.5 text-[10px] font-medium text-blue-800"
                >
                  <span className="size-4 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center font-bold shrink-0 text-[9px]">
                    {i + 1}
                  </span>
                  {step.replace(/^\d\. /, "")}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              The complaint text and uploaded images/PDFs are embedded (gemini-embedding-001, 768 dims).
              Top-5 policy chunks are retrieved via cosine similarity. Gemini 2.0 Flash performs
              multimodal reasoning and outputs structured JSON validated by Zod schema.
            </p>
          </div>

          {/* Visual Analysis */}
          {(visibleDamage !== undefined || damageType || claimImageConsistency) && (
            <div className="px-4 py-3">
              <SectionHeader icon={<Eye className="size-3.5 text-orange-600" />} label="Visual Analysis (Gemini Vision)" />
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                <DetailBox
                  label="Visible Damage"
                  value={visibleDamage === undefined ? "—" : visibleDamage ? "Yes" : "No"}
                  color={visibleDamage ? "red" : "emerald"}
                />
                <DetailBox
                  label="Damage Type"
                  value={damageType?.replace(/_/g, " ") ?? "—"}
                  color={damageType && damageType !== "none_visible" ? "orange" : "slate"}
                />
                <DetailBox
                  label="Claim Consistency"
                  value={claimImageConsistency?.replace(/_/g, " ") ?? "—"}
                  color={
                    claimImageConsistency === "supports_claim" ? "emerald"
                    : claimImageConsistency === "does_not_support_claim" ? "red"
                    : "slate"
                  }
                />
                <DetailBox
                  label="Serial Number Visible"
                  value={serialNumberVisible === undefined ? "—" : serialNumberVisible ? "Yes" : "No"}
                  color={serialNumberVisible ? "emerald" : "slate"}
                />
              </div>
              {evidenceQuality !== undefined && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-28">Evidence Quality</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full">
                    <div
                      className={cn(
                        "h-2 rounded-full",
                        evidenceQuality >= 70 ? "bg-emerald-400" : evidenceQuality >= 40 ? "bg-amber-400" : "bg-red-400"
                      )}
                      style={{ width: `${evidenceQuality}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums text-slate-700 w-8 text-right">{evidenceQuality}</span>
                </div>
              )}
            </div>
          )}

          {/* Document Analysis */}
          {(invoiceValid !== undefined || warrantyStatus || returnWindowStatus) && (
            <div className="px-4 py-3">
              <SectionHeader icon={<FileCheck className="size-3.5 text-blue-600" />} label="Document Analysis" />
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                <DetailBox
                  label="Invoice"
                  value={invoiceValid === null ? "Not provided" : invoiceValid ? "Valid" : "Invalid"}
                  color={invoiceValid === true ? "emerald" : invoiceValid === false ? "red" : "slate"}
                />
                <DetailBox
                  label="Warranty"
                  value={warrantyStatus ?? "—"}
                  color={warrantyStatus === "active" ? "emerald" : warrantyStatus === "expired" ? "red" : "slate"}
                />
                <DetailBox
                  label="Return Window"
                  value={returnWindowStatus?.replace(/_/g, " ") ?? "—"}
                  color={returnWindowStatus === "within" ? "emerald" : returnWindowStatus === "expired" ? "red" : "slate"}
                />
                <DetailBox
                  label="Product Value"
                  value={productValueAed ? `AED ${productValueAed.toLocaleString()}` : "—"}
                  color="slate"
                />
              </div>
            </div>
          )}

          {/* RVS Formula */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Shield className="size-3.5" />} label="RVS Weighted Formula" />
            <div className="mt-2 space-y-1.5">
              {RVS_WEIGHTS.map((w) => {
                const val =
                  w.field === "clarityScore"
                    ? clarityScore
                    : w.field === "evidenceQuality"
                    ? evidenceQuality
                    : w.field === "context"
                    ? 50
                    : undefined;
                return (
                  <div key={w.field} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-36 shrink-0">{w.label}</span>
                    <span className="text-[10px] font-mono text-slate-400 w-8">{w.weight}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full">
                      {val !== undefined && (
                        <div
                          className="h-2 bg-blue-400 rounded-full"
                          style={{ width: `${val}%` }}
                        />
                      )}
                    </div>
                    {val !== undefined && (
                      <span className="text-[10px] tabular-nums text-slate-600 w-8 text-right">
                        {val}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-mono">
              RVS = 0.20*clarity + 0.20*evidence + 0.25*docs + 0.25*policy + 0.10*context
            </p>
          </div>

          {/* Policy Retrieval */}
          {retrievedChunks.length > 0 && (
            <div className="px-4 py-3">
              <SectionHeader icon={<FileText className="size-3.5" />} label={`Policy Chunks Retrieved (${retrievedChunks.length}, ranked by cosine similarity)`} />
              <div className="mt-2 space-y-1">
                {retrievedChunks.map((chunk, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5"
                  >
                    <span className="text-[10px] font-mono text-slate-700">
                      {chunk.policyName} {chunk.sectionRef}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-200 rounded-full">
                        <div
                          className="h-1.5 bg-emerald-400 rounded-full"
                          style={{ width: `${Math.round(chunk.score * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-slate-500 font-mono">
                        {chunk.score.toFixed(3)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Policy Result */}
          {policyResult && (
            <div className="px-4 py-3">
              <SectionHeader icon={<Shield className="size-3.5 text-violet-600" />} label="Policy Compliance Assessment" />
              <p className="text-[10px] text-slate-600 mt-2 leading-relaxed bg-violet-50 rounded-lg p-2.5 border border-violet-100">
                {policyResult}
              </p>
              {relevantSections.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {relevantSections.map((s, i) => (
                    <span key={i} className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Verified Facts + Uncertainties + Contradictions */}
          {(verifiedFacts.length > 0 || uncertainties.length > 0 || contradictions.length > 0) && (
            <div className="px-4 py-3 grid md:grid-cols-3 gap-3">
              {verifiedFacts.length > 0 && (
                <div>
                  <SectionHeader icon={<Eye className="size-3.5 text-emerald-600" />} label={`Verified Facts (${verifiedFacts.length})`} />
                  <ul className="mt-2 space-y-1">
                    {verifiedFacts.map((f, i) => (
                      <li key={i} className="text-[10px] text-emerald-800 flex gap-1.5">
                        <span className="text-emerald-400 shrink-0">&#10003;</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {uncertainties.length > 0 && (
                <div>
                  <SectionHeader icon={<Eye className="size-3.5 text-amber-600" />} label={`Uncertainties (${uncertainties.length})`} />
                  <ul className="mt-2 space-y-1">
                    {uncertainties.map((u, i) => (
                      <li key={i} className="text-[10px] text-amber-800 flex gap-1.5">
                        <span className="text-amber-400 shrink-0">?</span>
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {contradictions.length > 0 && (
                <div>
                  <SectionHeader icon={<AlertTriangle className="size-3.5 text-red-600" />} label={`Contradictions (${contradictions.length})`} />
                  <ul className="mt-2 space-y-1">
                    {contradictions.map((c, i) => (
                      <li key={i} className="text-[10px] text-red-800 flex gap-1.5">
                        <span className="text-red-400 shrink-0">!</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: "slate" | "blue" | "amber" | "red" | "emerald" | "orange" }) {
  const cls: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    emerald: "bg-emerald-100 text-emerald-700",
    orange: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cls[color]}`}>
      {label}
    </span>
  );
}

function DetailBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "red" | "amber" | "orange" | "slate";
}) {
  const cls: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <div className={cn("rounded-lg border p-2", cls[color])}>
      <p className="text-[9px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-[11px] font-semibold capitalize">{value}</p>
    </div>
  );
}
