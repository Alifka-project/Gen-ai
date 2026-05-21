"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Shield,
  Eye,
  FileText,
  Cpu,
  FileCheck,
  AlertTriangle,
  Crosshair,
  Users,
  CheckCircle2,
  XCircle,
  Fingerprint,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RetrievedChunk = {
  policyName: string;
  sectionRef: string;
  score: number;
};

type DamageRegion = {
  region: string;
  description: string;
  severity: string;
  visible_in_images: number[];
};

type MultiModelInfo = {
  primary_model: string;
  secondary_model: string;
  secondary_recommendation: string;
  secondary_score: number;
  secondary_summary: string;
  consensus: {
    actionsMatch: boolean;
    scoreDelta: number;
    level: "high" | "medium" | "low";
    resolution: string;
    summary: string;
    matchPct: number;
  };
  critic?: {
    agrees_with_primary: boolean;
    confidence: number;
    disputed_fields: string[];
    critique: string;
    alternate_recommendation: string | null;
    model_used: string;
  };
};

type GuardEvent = {
  field: string;
  original: unknown;
  enforced: unknown;
  reason: string;
};

type EvidenceInspectedInfo = {
  imageCount: number;
  pdfCount: number;
  pdfPagesRead: number;
  pdfCharsExtracted: number;
  scannedPdfCount: number;
  policyChunksRetrieved: number;
  guardEvents: GuardEvent[];
};

type IdentityVerificationInfo = {
  form_serial: string | null;
  invoice_serial: string | null;
  photo_serial: string | null;
  serial_match: "match" | "partial_match" | "mismatch" | "insufficient_data";
  serial_sources_count: number;
  customer_name_match: {
    form_name: string;
    invoice_name: string | null;
    matches: boolean;
    similarity: number;
  };
  product_match: {
    expected_brand: string;
    expected_type: string;
    expected_capacity_kg: string;
    observed_brand: string | null;
    observed_type: string | null;
    observed_capacity_kg: string | null;
    brand_matches: boolean;
    type_matches: boolean;
    capacity_matches: boolean;
    overall_match: boolean;
  };
  exif: {
    taken_at: string | null;
    gps_lat: number | null;
    gps_lon: number | null;
    camera: string | null;
    width: number | null;
    height: number | null;
  } | null;
  identity_verified: boolean;
  identity_issues: string[];
  identity_score: number;
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
  damageRegions?: DamageRegion[];
  // Document analysis
  invoiceValid?: boolean | null;
  warrantyStatus?: string;
  returnWindowStatus?: string;
  productValueAed?: number | null;
  // Policy
  relevantSections?: string[];
  policyResult?: string;
  // Multi-agent ensemble
  multiModel?: MultiModelInfo;
  evidenceInspected?: EvidenceInspectedInfo;
  identityVerification?: IdentityVerificationInfo;
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
  modelUsed = "gpt-4o",
  latencyMs,
  visibleDamage,
  damageType,
  claimImageConsistency,
  serialNumberVisible,
  damageRegions = [],
  invoiceValid,
  warrantyStatus,
  returnWindowStatus,
  productValueAed,
  relevantSections = [],
  policyResult,
  multiModel,
  evidenceInspected,
  identityVerification,
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
          {multiModel ? (
            <Chip
              label={`Ensemble: ${multiModel.consensus.level} consensus (${multiModel.consensus.matchPct}%)`}
              color={
                multiModel.consensus.level === "high"
                  ? "emerald"
                  : multiModel.consensus.level === "medium"
                    ? "amber"
                    : "red"
              }
            />
          ) : null}
          {multiModel?.critic ? (
            <Chip
              label={`Critic: ${multiModel.critic.agrees_with_primary ? "agrees" : "DISPUTES"} (${multiModel.critic.confidence}%)`}
              color={multiModel.critic.agrees_with_primary ? "emerald" : "red"}
            />
          ) : null}
          {evidenceInspected ? (
            <Chip
              label={`Evidence: ${evidenceInspected.imageCount} img · ${evidenceInspected.pdfCount} pdf`}
              color="slate"
            />
          ) : null}
          {identityVerification ? (
            <Chip
              label={`Identity: ${identityVerification.identity_verified ? "VERIFIED" : identityVerification.serial_match === "insufficient_data" ? "insufficient data" : "UNVERIFIED"} (${identityVerification.identity_score}/100)`}
              color={
                identityVerification.identity_verified
                  ? "emerald"
                  : identityVerification.serial_match === "mismatch" ||
                      !identityVerification.product_match.overall_match
                    ? "red"
                    : "amber"
              }
            />
          ) : null}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {/* Method explanation */}
          <div className="px-4 py-3">
            <SectionHeader icon={<Cpu className="size-3.5" />} label="AI Method & Pipeline (Multi-Agent, Multi-Model)" />
            <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-1.5">
              {[
                { n: 1, label: "RAG · pgvector top-5", color: "blue" },
                { n: 2, label: "Primary · GPT-4o vision", color: "violet" },
                { n: 3, label: "Secondary · Claude Sonnet 4.5", color: "orange" },
                { n: 4, label: "Evidence guards", color: "emerald" },
                { n: 5, label: "Critic · GPT-4o", color: "red" },
                { n: 6, label: "Consensus arbiter", color: "amber" },
              ].map((step) => (
                <div
                  key={step.n}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2 py-1.5 text-[10px] font-medium",
                    step.color === "blue" && "bg-blue-50 text-blue-800",
                    step.color === "violet" && "bg-violet-50 text-violet-800",
                    step.color === "orange" && "bg-orange-50 text-orange-800",
                    step.color === "emerald" && "bg-emerald-50 text-emerald-800",
                    step.color === "red" && "bg-red-50 text-red-800",
                    step.color === "amber" && "bg-amber-50 text-amber-800"
                  )}
                >
                  <span
                    className={cn(
                      "size-4 rounded-full flex items-center justify-center font-bold shrink-0 text-[9px]",
                      step.color === "blue" && "bg-blue-200",
                      step.color === "violet" && "bg-violet-200",
                      step.color === "orange" && "bg-orange-200",
                      step.color === "emerald" && "bg-emerald-200",
                      step.color === "red" && "bg-red-200",
                      step.color === "amber" && "bg-amber-200"
                    )}
                  >
                    {step.n}
                  </span>
                  {step.label}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Complaint + product context + uploaded evidence run through TWO model
              families in parallel (GPT-4o + Claude Sonnet 4.5). A GPT-4o critic
              reviews the primary&apos;s output. The consensus arbiter compares the
              two analyzers; if they disagree, the system promotes to the safer
              action. Evidence guards null any field whose underlying input was
              missing.
            </p>
          </div>

          {/* ── MULTI-MODEL ENSEMBLE ── */}
          {multiModel ? (
            <div className="px-4 py-3">
              <SectionHeader
                icon={<Users className="size-3.5 text-violet-600" />}
                label="Multi-Model Ensemble — Two Independent Verdicts"
              />
              <div className="mt-2 grid md:grid-cols-2 gap-2">
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-violet-700">
                    Primary · {multiModel.primary_model}
                  </p>
                  <p className="text-[11px] mt-1">
                    Action:{" "}
                    <code className="font-mono bg-white px-1 rounded">
                      {/* The top-level recommendation may have been promoted by consensus */}
                      shown in the badge above
                    </code>
                  </p>
                  <p className="text-[10px] text-violet-800 mt-0.5">
                    RVS: <strong>{score}</strong> · this row drives the final
                    recommendation after guards + consensus
                  </p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-orange-700">
                    Secondary · {multiModel.secondary_model}
                  </p>
                  <p className="text-[11px] mt-1">
                    Action:{" "}
                    <code className="font-mono bg-white px-1 rounded">
                      {multiModel.secondary_recommendation}
                    </code>
                  </p>
                  <p className="text-[10px] text-orange-800 mt-0.5">
                    RVS: <strong>{multiModel.secondary_score}</strong>
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  "mt-2 rounded-lg border p-2.5 flex items-start gap-2",
                  multiModel.consensus.level === "high" &&
                    "border-emerald-200 bg-emerald-50",
                  multiModel.consensus.level === "medium" &&
                    "border-amber-200 bg-amber-50",
                  multiModel.consensus.level === "low" &&
                    "border-red-200 bg-red-50"
                )}
              >
                {multiModel.consensus.actionsMatch ? (
                  <CheckCircle2
                    className={cn(
                      "size-4 shrink-0 mt-0.5",
                      multiModel.consensus.level === "high"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    )}
                  />
                ) : (
                  <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={cn(
                      "text-[11px] font-semibold",
                      multiModel.consensus.level === "high"
                        ? "text-emerald-900"
                        : multiModel.consensus.level === "medium"
                          ? "text-amber-900"
                          : "text-red-900"
                    )}
                  >
                    Consensus: {multiModel.consensus.level.toUpperCase()} —{" "}
                    {multiModel.consensus.matchPct}% field agreement · score
                    delta {multiModel.consensus.scoreDelta}
                  </p>
                  <p className="text-[10px] text-slate-700 mt-0.5">
                    {multiModel.consensus.summary}
                  </p>
                </div>
              </div>

              {multiModel.secondary_summary ? (
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Secondary&apos;s manager summary
                  </p>
                  <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
                    {multiModel.secondary_summary}
                  </p>
                </div>
              ) : null}

              {multiModel.critic ? (
                <div
                  className={cn(
                    "mt-2 rounded-lg border p-2.5",
                    multiModel.critic.agrees_with_primary
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {multiModel.critic.agrees_with_primary ? (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p
                        className={cn(
                          "text-[11px] font-semibold",
                          multiModel.critic.agrees_with_primary
                            ? "text-emerald-900"
                            : "text-red-900"
                        )}
                      >
                        Critic ({multiModel.critic.model_used}):{" "}
                        {multiModel.critic.agrees_with_primary
                          ? "agrees with primary"
                          : "disputes primary"}{" "}
                        — confidence {multiModel.critic.confidence}%
                      </p>
                      <p className="text-[10px] text-slate-700 mt-0.5">
                        {multiModel.critic.critique}
                      </p>
                      {multiModel.critic.disputed_fields.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {multiModel.critic.disputed_fields.map((f, i) => (
                            <span
                              key={i}
                              className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-mono"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {multiModel.critic.alternate_recommendation ? (
                        <p className="text-[10px] text-red-900 mt-1">
                          <strong>Critic&apos;s alternate:</strong>{" "}
                          <code className="font-mono">
                            {multiModel.critic.alternate_recommendation}
                          </code>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ── EVIDENCE PROVENANCE ── */}
          {evidenceInspected ? (
            <div className="px-4 py-3">
              <SectionHeader
                icon={<Shield className="size-3.5 text-blue-600" />}
                label="Evidence Provenance (what the model actually inspected)"
              />
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                <DetailBox
                  label="Images inspected"
                  value={`${evidenceInspected.imageCount} via vision`}
                  color={evidenceInspected.imageCount > 0 ? "emerald" : "slate"}
                />
                <DetailBox
                  label="PDFs inspected"
                  value={
                    evidenceInspected.pdfCount > 0
                      ? `${evidenceInspected.pdfCount} (${evidenceInspected.pdfCharsExtracted.toLocaleString()} chars)`
                      : "none"
                  }
                  color={evidenceInspected.pdfCount > 0 ? "emerald" : "slate"}
                />
                <DetailBox
                  label="Policy chunks (RAG)"
                  value={`${evidenceInspected.policyChunksRetrieved} retrieved`}
                  color="emerald"
                />
                <DetailBox
                  label="Guards triggered"
                  value={
                    evidenceInspected.guardEvents.length === 0
                      ? "none"
                      : `${evidenceInspected.guardEvents.length} override(s)`
                  }
                  color={
                    evidenceInspected.guardEvents.length === 0 ? "emerald" : "amber"
                  }
                />
              </div>
              {evidenceInspected.guardEvents.length > 0 ? (
                <details className="mt-2">
                  <summary className="text-[10px] text-amber-700 cursor-pointer hover:text-amber-900">
                    Show {evidenceInspected.guardEvents.length} guard event(s)
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {evidenceInspected.guardEvents.map((ev, i) => (
                      <li
                        key={i}
                        className="text-[10px] bg-amber-50 border border-amber-200 rounded px-2 py-1.5"
                      >
                        <code className="font-mono text-amber-900 font-semibold">
                          {ev.field}
                        </code>
                        <span className="text-slate-600"> — {ev.reason}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}

          {/* ── IDENTITY VERIFICATION ── */}
          {identityVerification ? (
            <div className="px-4 py-3">
              <SectionHeader
                icon={<Fingerprint className="size-3.5 text-blue-600" />}
                label="Identity Verification — Is This Really the Item Purchased?"
              />
              <div
                className={cn(
                  "mt-2 rounded-lg border p-3",
                  identityVerification.identity_verified
                    ? "border-emerald-300 bg-emerald-50"
                    : identityVerification.identity_issues.length > 0
                      ? "border-red-300 bg-red-50"
                      : "border-amber-300 bg-amber-50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {identityVerification.identity_verified ? (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle
                        className={cn(
                          "size-4 shrink-0 mt-0.5",
                          identityVerification.identity_issues.length > 0
                            ? "text-red-600"
                            : "text-amber-600"
                        )}
                      />
                    )}
                    <div>
                      <p
                        className={cn(
                          "text-[11px] font-bold uppercase tracking-wider",
                          identityVerification.identity_verified
                            ? "text-emerald-900"
                            : identityVerification.identity_issues.length > 0
                              ? "text-red-900"
                              : "text-amber-900"
                        )}
                      >
                        {identityVerification.identity_verified
                          ? "Identity verified"
                          : identityVerification.identity_issues.length === 0
                            ? "Insufficient identity evidence"
                            : "Identity unverified"}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Identity score:{" "}
                        <strong className="tabular-nums">
                          {identityVerification.identity_score}/100
                        </strong>{" "}
                        · serial match:{" "}
                        <strong>{identityVerification.serial_match.replace(/_/g, " ")}</strong>
                        {" "}({identityVerification.serial_sources_count}/3 sources)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Three-way serial table */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <SerialChip
                    label="Form (intake)"
                    value={identityVerification.form_serial}
                  />
                  <SerialChip
                    label="Invoice (extracted)"
                    value={identityVerification.invoice_serial}
                  />
                  <SerialChip
                    label="Photo (vision OCR)"
                    value={identityVerification.photo_serial}
                  />
                </div>

                {/* Product match */}
                <div className="mt-3 rounded border border-slate-200 bg-white p-2">
                  <p className="text-[10px] font-semibold text-slate-700 mb-1">
                    Photo product vs catalogue
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <MatchRow
                      label="Brand"
                      expected={identityVerification.product_match.expected_brand}
                      observed={identityVerification.product_match.observed_brand}
                      matches={identityVerification.product_match.brand_matches}
                    />
                    <MatchRow
                      label="Type"
                      expected={identityVerification.product_match.expected_type}
                      observed={identityVerification.product_match.observed_type}
                      matches={identityVerification.product_match.type_matches}
                    />
                    <MatchRow
                      label="Capacity"
                      expected={`${identityVerification.product_match.expected_capacity_kg} kg`}
                      observed={
                        identityVerification.product_match.observed_capacity_kg
                          ? `${identityVerification.product_match.observed_capacity_kg} kg`
                          : null
                      }
                      matches={identityVerification.product_match.capacity_matches}
                    />
                  </div>
                </div>

                {/* Customer name match */}
                <div className="mt-2 rounded border border-slate-200 bg-white p-2 flex items-center justify-between text-[10px]">
                  <span className="text-slate-600">
                    Customer name match (form vs invoice)
                  </span>
                  <span className="flex items-center gap-2">
                    <code className="font-mono text-slate-700">
                      {identityVerification.customer_name_match.form_name}
                    </code>
                    <span className="text-slate-400">vs</span>
                    <code className="font-mono text-slate-700">
                      {identityVerification.customer_name_match.invoice_name ?? "—"}
                    </code>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums",
                        identityVerification.customer_name_match.matches
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      )}
                    >
                      {identityVerification.customer_name_match.similarity}%
                    </span>
                  </span>
                </div>

                {/* EXIF */}
                {identityVerification.exif ? (
                  <div className="mt-2 rounded border border-slate-200 bg-white p-2 text-[10px]">
                    <p className="text-slate-600">
                      <strong>EXIF (first image)</strong>
                      {identityVerification.exif.taken_at && (
                        <>
                          {" "}· taken{" "}
                          <code className="font-mono">
                            {identityVerification.exif.taken_at}
                          </code>
                        </>
                      )}
                      {identityVerification.exif.camera && (
                        <>
                          {" "}· camera{" "}
                          <code className="font-mono">
                            {identityVerification.exif.camera}
                          </code>
                        </>
                      )}
                      {identityVerification.exif.gps_lat !== null && (
                        <>
                          {" "}· GPS{" "}
                          <code className="font-mono">
                            {identityVerification.exif.gps_lat.toFixed(4)},{" "}
                            {identityVerification.exif.gps_lon?.toFixed(4)}
                          </code>
                        </>
                      )}
                    </p>
                  </div>
                ) : null}

                {/* Issues */}
                {identityVerification.identity_issues.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {identityVerification.identity_issues.map((iss, i) => (
                      <li
                        key={i}
                        className="text-[10px] text-red-900 flex gap-1.5"
                      >
                        <span className="text-red-400 shrink-0">!</span>
                        {iss}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ── DAMAGE REGIONS (vision output) ── */}
          {damageRegions.length > 0 ? (
            <div className="px-4 py-3">
              <SectionHeader
                icon={<Crosshair className="size-3.5 text-red-600" />}
                label={`Detected Damage Regions (${damageRegions.length}) — observed by vision model`}
              />
              <div className="mt-2 grid md:grid-cols-2 gap-2">
                {damageRegions.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border p-2.5",
                      r.severity === "critical" || r.severity === "high"
                        ? "border-red-300 bg-red-50"
                        : r.severity === "medium"
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold text-slate-900">
                        {r.region}
                      </p>
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                          r.severity === "critical" && "bg-red-200 text-red-900",
                          r.severity === "high" && "bg-red-100 text-red-800",
                          r.severity === "medium" && "bg-amber-100 text-amber-800",
                          r.severity === "low" && "bg-slate-200 text-slate-700"
                        )}
                      >
                        {r.severity}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
                      {r.description}
                    </p>
                    {r.visible_in_images.length > 0 ? (
                      <p className="text-[9px] text-slate-500 mt-1 font-mono">
                        visible in image{r.visible_in_images.length === 1 ? "" : "s"}:{" "}
                        {r.visible_in_images.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Visual Analysis */}
          {(visibleDamage !== undefined || damageType || claimImageConsistency) && (
            <div className="px-4 py-3">
              <SectionHeader icon={<Eye className="size-3.5 text-orange-600" />} label="Visual Analysis (GPT-4o Vision)" />
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

function SerialChip({ label, value }: { label: string; value: string | null }) {
  return (
    <div
      className={cn(
        "rounded border p-1.5",
        value ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50"
      )}
    >
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          "text-[10px] font-mono mt-0.5 truncate",
          value ? "text-slate-900 font-semibold" : "text-slate-400 italic"
        )}
      >
        {value ?? "not provided"}
      </p>
    </div>
  );
}

function MatchRow({
  label,
  expected,
  observed,
  matches,
}: {
  label: string;
  expected: string;
  observed: string | null;
  matches: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex items-center gap-1 mt-0.5">
        <p className="text-[10px] text-slate-700 truncate" title={expected}>
          {expected}
        </p>
        <span
          className={cn(
            "text-[10px] font-bold shrink-0",
            observed === null
              ? "text-slate-300"
              : matches
                ? "text-emerald-600"
                : "text-red-600"
          )}
        >
          {observed === null ? "—" : matches ? "✓" : "✗"}
        </span>
      </div>
      {observed && observed !== expected ? (
        <p className="text-[9px] text-slate-500 truncate" title={observed}>
          observed: {observed}
        </p>
      ) : null}
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
