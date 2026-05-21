"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Brain,
  Cpu,
  Database,
  FileSearch,
  CheckCircle2,
  ArrowRight,
  Zap,
  Target,
  BarChart3,
  Eye,
  Shield,
  AlertTriangle,
  FileText,
  TrendingUp,
  Layers,
  Activity,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

/* ─── Types ─── */
type CaseDetail = {
  caseId: string;
  customerName: string;
  productModel: string;
  serialNumber: string | null;
  complaintText: string;
  requestedAction: string;
  status: string;
  latencyMs: number;
  score: number;
  recommendation: string;
  modelUsed: string;
  retrievedChunks: Array<{ policyName: string; sectionRef: string; score: number }>;
  createdAt: string;
  rvsComputed: number | null;
  rvsDrift: number | null;
  clarityScore: number | null;
  evidenceQuality: number | null;
  visibleDamage: boolean | null;
  damageType: string | null;
  complaintCategory: string | null;
  severity: string | null;
  managerSummary: string | null;
  verifiedFactsCount: number;
  uncertaintiesCount: number;
  contradictionsCount: number;
  invoiceValid: boolean | null;
  warrantyStatus: string | null;
};

type GuardEvent = {
  field: string;
  original: unknown;
  enforced: unknown;
  reason: string;
};

type EvidenceInspected = {
  imageCount: number;
  pdfCount: number;
  pdfPagesRead: number;
  pdfCharsExtracted: number;
  scannedPdfCount: number;
  policyChunksRetrieved: number;
  guardEvents: GuardEvent[];
};

type StatsData = {
  totalAnalyses: number;
  avgLatencyMs: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  recommendationCounts: Record<string, number>;
  scoreDistribution: Array<{ range: string; count: number }>;
  caseDetails: (CaseDetail & { evidenceInspected: EvidenceInspected | null })[];
  policyChunkCount: number;
  modelsUsed: string[];
  avgRetrievedChunks: number;
  avgChunkSimilarity: number;
  rvsAccuracy: number;
  antiHallucination?: {
    totalGuardEvents: number;
    casesWithGuards: number;
    totalCases: number;
    totalImagesInspected: number;
    totalPdfCharsExtracted: number;
    totalScannedPdfs: number;
    guardEventsByField: Record<string, number>;
  };
};

const REC_COLORS: Record<string, string> = {
  approve_replacement: "#16a34a",
  reject_request: "#dc2626",
  request_more_evidence: "#ca8a04",
  remote_troubleshooting: "#2563eb",
  send_technician: "#4f46e5",
  escalate_manager: "#ea580c",
};

const REC_LABELS: Record<string, string> = {
  approve_replacement: "Approve",
  reject_request: "Reject",
  request_more_evidence: "More Evidence",
  remote_troubleshooting: "Remote Fix",
  send_technician: "Technician",
  escalate_manager: "Escalate",
};

/* ─── Main Component ─── */
export default function AiPipelinePage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);

  useEffect(() => {
    fetch("/api/ai/stats")
      .then((r) => r.json())
      .then((d) => {
        setStats(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-100 mt-0.5">
          <Cpu className="size-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            AI Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            End-to-end view of the Multimodal RAG pipeline — model configuration,
            retrieval mechanics, scoring formula, accuracy metrics, and per-case
            processing details.
          </p>
        </div>
      </div>

      {/* ── 1. Pipeline Architecture Flow ── */}
      <Card className="p-5 bg-white shadow-sm border-slate-200">
        <SectionHeader icon={<Layers className="size-4 text-blue-600" />} label="AI Pipeline Architecture" />
        <p className="text-xs text-slate-500 mb-4">
          Multimodal RAG (Retrieval-Augmented Generation) pipeline powering every case analysis.
        </p>
        <div className="flex flex-col md:flex-row items-stretch gap-0 overflow-x-auto">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={i} className="flex md:flex-col items-center md:items-stretch flex-1 min-w-0">
              <div
                className={`flex-1 rounded-xl border-2 p-3 text-center ${step.color} relative`}
              >
                <div className="flex justify-center mb-1.5">{step.icon}</div>
                <p className="text-[11px] font-bold text-slate-800 leading-tight">{step.label}</p>
                <p className="text-[9px] text-slate-500 mt-1 leading-tight hidden md:block">{step.detail}</p>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="flex items-center justify-center shrink-0 mx-1 md:my-1 md:mx-auto">
                  <ArrowRight className="size-4 text-slate-300 rotate-0 md:rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Step labels on small screens */}
        <div className="md:hidden mt-3 space-y-1">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="font-bold text-slate-700">Step {i + 1}:</span>
              {step.label} — {step.detail}
            </div>
          ))}
        </div>
      </Card>

      {/* ── 2. Model Configuration ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 bg-white shadow-sm border-slate-200">
          <SectionHeader icon={<Brain className="size-4 text-violet-600" />} label="Multimodal LLM Configuration" />
          <div className="mt-3 space-y-2">
            {MODEL_CONFIG.map((cfg) => (
              <div key={cfg.key} className="flex items-start justify-between py-1.5 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-500">{cfg.key}</span>
                <span className="text-xs font-semibold text-slate-900 text-right ml-4 font-mono">
                  {cfg.value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 bg-white shadow-sm border-slate-200">
          <SectionHeader icon={<Database className="size-4 text-emerald-600" />} label="Embedding & Vector Store" />
          <div className="mt-3 space-y-2">
            {EMBEDDING_CONFIG.map((cfg) => (
              <div key={cfg.key} className="flex items-start justify-between py-1.5 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-500">{cfg.key}</span>
                <span className="text-xs font-semibold text-slate-900 text-right ml-4 font-mono">
                  {cfg.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── 3. Live Stats ── */}
      {loading ? (
        <Card className="p-6 bg-white shadow-sm border-slate-200 text-center">
          <Activity className="size-6 text-slate-300 mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-slate-500">Loading live metrics...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 border-red-200 bg-red-50 text-sm text-red-800">
          Error loading stats: {error}
        </Card>
      ) : stats ? (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatPill label="Analyses Run" value={stats.totalAnalyses.toString()} icon={<Cpu className="size-4 text-blue-500" />} />
            <StatPill label="Avg Latency" value={`${stats.avgLatencyMs}ms`} icon={<Zap className="size-4 text-yellow-500" />} />
            <StatPill label="Avg RVS Score" value={`${stats.avgScore}/100`} icon={<Target className="size-4 text-emerald-500" />} />
            <StatPill label="Policy Chunks" value={stats.policyChunkCount.toString()} icon={<FileSearch className="size-4 text-violet-500" />} />
            <StatPill label="RVS Accuracy" value={`${stats.rvsAccuracy}%`} icon={<CheckCircle2 className="size-4 text-emerald-500" />} sub="model vs computed drift ≤20" />
          </div>

          {/* ── Anti-Hallucination / Evidence Provenance ── */}
          {stats.antiHallucination ? (
            <AntiHallucinationPanel
              agg={stats.antiHallucination}
              cases={stats.caseDetails}
            />
          ) : null}

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Recommendation distribution */}
            <Card className="p-5 bg-white shadow-sm border-slate-200">
              <SectionHeader icon={<BarChart3 className="size-4 text-blue-600" />} label="Recommendation Distribution" />
              <p className="text-xs text-slate-500 mb-3">AI output across all analyzed cases</p>
              {Object.keys(stats.recommendationCounts).length === 0 ? (
                <EmptyState label="No analyses yet" />
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(stats.recommendationCounts).map(([k, v]) => ({
                        key: k,
                        label: REC_LABELS[k] ?? k,
                        count: v,
                      }))}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {Object.keys(stats.recommendationCounts).map((k) => (
                          <Cell key={k} fill={REC_COLORS[k] ?? "#64748b"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Score Distribution */}
            <Card className="p-5 bg-white shadow-sm border-slate-200">
              <SectionHeader icon={<TrendingUp className="size-4 text-violet-600" />} label="RVS Score Distribution" />
              <p className="text-xs text-slate-500 mb-3">Replacement Validity Score spread across cases</p>
              {stats.scoreDistribution.every((d) => d.count === 0) ? (
                <EmptyState label="No analyses yet" />
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.scoreDistribution}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {stats.scoreDistribution.map((d, i) => (
                          <Cell
                            key={i}
                            fill={
                              d.range === "81–100"
                                ? "#16a34a"
                                : d.range === "61–80"
                                ? "#2563eb"
                                : d.range === "41–60"
                                ? "#ca8a04"
                                : d.range === "21–40"
                                ? "#ea580c"
                                : "#dc2626"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* ── 4. RVS Formula Visual ── */}
          <Card className="p-5 bg-white shadow-sm border-slate-200">
            <SectionHeader icon={<Target className="size-4 text-emerald-600" />} label="Replacement Validity Score (RVS) — Weighted Formula" />
            <p className="text-xs text-slate-500 mb-4">
              The RVS is deterministically computed from the GPT-4o output using this weighted formula.
              It serves as an independent sanity check on the AI&apos;s own score. A drift of more than 20 points
              triggers a warning in the case UI.
            </p>
            <div className="rounded-lg bg-slate-900 text-emerald-400 p-3 font-mono text-xs mb-4 leading-relaxed">
              <p>RVS = <span className="text-yellow-400">0.20</span> × clarity_score</p>
              <p>    + <span className="text-yellow-400">0.20</span> × evidence_quality_score</p>
              <p>    + <span className="text-yellow-400">0.25</span> × document_eligibility_score</p>
              <p>    + <span className="text-yellow-400">0.25</span> × policy_compliance_score</p>
              <p>    + <span className="text-yellow-400">0.10</span> × historical_context <span className="text-slate-500">{`// fixed at 50 for MVP`}</span></p>
            </div>
            <div className="space-y-3">
              {RVS_FACTORS.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-40 shrink-0">
                    <p className="text-xs font-semibold text-slate-700">{f.label}</p>
                    <p className="text-[10px] text-slate-400">{f.source}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex-1 h-3 rounded-full bg-slate-100">
                      <div
                        className={`h-3 rounded-full ${f.color}`}
                        style={{ width: `${f.weight * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-700 tabular-nums w-8">
                      {Math.round(f.weight * 100)}%
                    </span>
                  </div>
                  <p className="w-48 text-[10px] text-slate-500 hidden lg:block">{f.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {SCORE_BANDS.map((band) => (
                <div key={band.label} className={`rounded-lg p-2.5 ${band.bg}`}>
                  <p className={`text-xs font-bold ${band.text}`}>{band.range}</p>
                  <p className={`text-[10px] ${band.text} opacity-70`}>{band.label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* ── 5. Zod Output Schema ── */}
          <Card className="p-5 bg-white shadow-sm border-slate-200">
            <SectionHeader icon={<Shield className="size-4 text-blue-600" />} label="Zod Output Schema — Validated AI Output Structure" />
            <p className="text-xs text-slate-500 mb-4">
              Every GPT-4o response is validated against this strict Zod schema before being persisted.
              Invalid outputs trigger one automatic repair retry with additional instructions.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZOD_SCHEMA_FIELDS.map((group) => (
                <div key={group.section} className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className={`px-3 py-2 ${group.bg} border-b border-slate-200`}>
                    <p className="text-[11px] font-bold text-slate-800">{group.section}</p>
                  </div>
                  <div className="p-2.5 space-y-1">
                    {group.fields.map((f) => (
                      <div key={f.name} className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono text-slate-600">{f.name}</span>
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">{f.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ── 6. Defect Detection Illustration ── */}
          <Card className="p-5 bg-white shadow-sm border-slate-200">
            <SectionHeader icon={<Eye className="size-4 text-orange-600" />} label="Multimodal Defect Detection — How GPT-4o Analyzes Images" />
            <div className="mt-4 grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <DefectDetectionDiagram />
              </div>
              <div className="md:col-span-2 space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Uploaded product images and invoice PDFs are encoded as base64 and passed
                  directly to <strong>GPT-4o</strong> along with the structured complaint
                  text and retrieved policy context. GPT-4o performs simultaneous visual and
                  textual reasoning, producing structured JSON output validated by Zod.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {VISUAL_OUTPUTS.map((o) => (
                    <div key={o.field} className="rounded-lg border border-slate-200 p-2.5">
                      <p className="text-[10px] font-mono text-slate-500">{o.field}</p>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5">{o.type}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{o.description}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <p className="text-[11px] text-orange-800 font-semibold mb-1 flex items-center gap-1">
                    <AlertTriangle className="size-3.5" />
                    Important: AI Image Limitations
                  </p>
                  <p className="text-[10px] text-orange-700 leading-relaxed">
                    Per Warranty Policy §3.2(c), photographic evidence alone cannot prove functional
                    defects. AI visual analysis detects visible physical damage only. For functional
                    faults (e.g. washer not spinning), a technician visit is always required regardless
                    of AI output. The AI system will recommend &quot;send_technician&quot; or &quot;remote_troubleshooting&quot;
                    for functional fault categories.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* ── 6. RAG Retrieval Details ── */}
          <Card className="p-5 bg-white shadow-sm border-slate-200">
            <SectionHeader icon={<FileSearch className="size-4 text-violet-600" />} label="RAG Policy Retrieval — Vector Search Mechanics" />
            <div className="mt-3 grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-2">
                <MetricRow label="Policy Chunks Indexed" value={stats.policyChunkCount.toString()} />
                <MetricRow label="Chunks Retrieved / Case" value={`Top ${stats.avgRetrievedChunks}`} />
                <MetricRow label="Avg Similarity Score" value={stats.avgChunkSimilarity.toFixed(3)} />
                <MetricRow label="Embedding Model" value="text-embedding-3-small" />
                <MetricRow label="Vector Dimensions" value="768" />
                <MetricRow label="Similarity Metric" value="Cosine" />
                <MetricRow label="Vector Store" value="Neon pgvector" />
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500 mb-2">Retrieval pipeline:</p>
                <div className="space-y-1.5">
                  {RAG_STEPS.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="size-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{step.label}</p>
                        <p className="text-[10px] text-slate-500">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-violet-50 border border-violet-200 p-3">
                  <p className="text-[10px] text-violet-800 font-mono leading-relaxed">
                    SELECT id, policy_name, section_ref, chunk_text,<br />
                    &nbsp;&nbsp;1 - (embedding &lt;=&gt; query_vector) AS similarity<br />
                    FROM policy_chunks<br />
                    ORDER BY embedding &lt;=&gt; query_vector<br />
                    LIMIT 5;
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* ── 7. Per-case Analysis Table ── */}
          <Card className="p-5 bg-white shadow-sm border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader icon={<FileText className="size-4 text-slate-600" />} label="Per-Case AI Processing Log" />
              <span className="text-xs text-slate-400">{stats.caseDetails.length} cases analyzed</span>
            </div>
            {stats.caseDetails.length === 0 ? (
              <EmptyState label="No cases analyzed yet. Run analysis on a case to see details here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {[
                        "Customer",
                        "Product",
                        "Action",
                        "RVS",
                        "Computed",
                        "Drift",
                        "Clarity",
                        "Evidence",
                        "Damage",
                        "Invoice",
                        "Warranty",
                        "Recommendation",
                        "Model",
                        "Latency",
                        "Facts",
                        "Uncertain",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.caseDetails.map((c) => (
                      <tr
                        key={c.caseId}
                        onClick={() => setSelectedCase(selectedCase?.caseId === c.caseId ? null : c)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-2.5 py-2 font-medium text-slate-900 whitespace-nowrap">
                          {c.customerName}
                        </td>
                        <td className="px-2.5 py-2 font-mono text-slate-600 whitespace-nowrap">
                          {c.productModel}
                        </td>
                        <td className="px-2.5 py-2 text-slate-500 whitespace-nowrap">
                          {c.requestedAction}
                        </td>
                        <td className="px-2.5 py-2">
                          <ScoreChip score={c.score} />
                        </td>
                        <td className="px-2.5 py-2">
                          {c.rvsComputed !== null ? (
                            <ScoreChip score={c.rvsComputed} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          {c.rvsDrift !== null ? (
                            <span
                              className={`font-mono font-bold ${
                                c.rvsDrift > 20
                                  ? "text-red-600"
                                  : c.rvsDrift > 10
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {c.rvsDrift}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums">
                          {c.clarityScore ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums">
                          {c.evidenceQuality ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          {c.damageType ? (
                            <span className="text-[10px] bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">
                              {c.damageType.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          {c.invoiceValid === true ? (
                            <span className="text-emerald-600">✓ valid</span>
                          ) : c.invoiceValid === false ? (
                            <span className="text-red-500">✗ invalid</span>
                          ) : (
                            <span className="text-slate-400">unknown</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          {c.warrantyStatus ? (
                            <span
                              className={`text-[10px] rounded px-1.5 py-0.5 ${
                                c.warrantyStatus === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : c.warrantyStatus === "expired"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {c.warrantyStatus}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          <span
                            className="text-[10px] rounded-full px-1.5 py-0.5 font-medium"
                            style={{
                              backgroundColor: `${REC_COLORS[c.recommendation]}20`,
                              color: REC_COLORS[c.recommendation] ?? "#64748b",
                            }}
                          >
                            {REC_LABELS[c.recommendation] ?? c.recommendation}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                          {c.modelUsed}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums text-slate-500">
                          {c.latencyMs}ms
                        </td>
                        <td className="px-2.5 py-2 tabular-nums text-emerald-700">
                          {c.verifiedFactsCount}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums text-amber-700">
                          {c.uncertaintiesCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── 8. Selected Case Detail ── */}
          {selectedCase && (
            <Card className="p-5 bg-white shadow-sm border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader
                  icon={<Brain className="size-4 text-blue-600" />}
                  label={`Detailed Processing — ${selectedCase.customerName}`}
                />
                <button
                  onClick={() => setSelectedCase(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Radar chart for scores */}
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Score Radar</p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        data={[
                          { subject: "Clarity", value: selectedCase.clarityScore ?? 0 },
                          { subject: "Evidence", value: selectedCase.evidenceQuality ?? 0 },
                          { subject: "RVS", value: selectedCase.score },
                          { subject: "Facts", value: Math.min(100, selectedCase.verifiedFactsCount * 20) },
                          { subject: "Uncertainty", value: Math.max(0, 100 - selectedCase.uncertaintiesCount * 25) },
                        ]}
                      >
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8 }} />
                        <Radar name="Score" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Case metadata */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Analysis Metadata</p>
                  {[
                    { label: "Case ID", value: selectedCase.caseId },
                    { label: "Product", value: selectedCase.productModel },
                    { label: "Action Requested", value: selectedCase.requestedAction },
                    { label: "AI Model", value: selectedCase.modelUsed },
                    { label: "Latency", value: `${selectedCase.latencyMs}ms` },
                    { label: "Complaint Category", value: selectedCase.complaintCategory ?? "—" },
                    { label: "Severity", value: selectedCase.severity ?? "—" },
                    { label: "Visible Damage", value: selectedCase.visibleDamage === null ? "—" : selectedCase.visibleDamage ? "Yes" : "No" },
                    { label: "Damage Type", value: selectedCase.damageType?.replace(/_/g, " ") ?? "—" },
                    { label: "Invoice Valid", value: selectedCase.invoiceValid === null ? "Unknown" : selectedCase.invoiceValid ? "Yes" : "No" },
                    { label: "Warranty", value: selectedCase.warrantyStatus ?? "—" },
                    { label: "Facts Verified", value: selectedCase.verifiedFactsCount.toString() },
                    { label: "Uncertainties", value: selectedCase.uncertaintiesCount.toString() },
                    { label: "Contradictions", value: selectedCase.contradictionsCount.toString() },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-[11px] text-slate-500">{row.label}</span>
                      <span className="text-[11px] font-semibold text-slate-900 font-mono">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complaint text */}
              {selectedCase.complaintText && (
                <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400 mb-1">
                    Customer Complaint (Input)
                  </p>
                  <p className="text-xs text-blue-800 leading-relaxed">{selectedCase.complaintText}</p>
                </div>
              )}

              {/* Manager summary */}
              {selectedCase.managerSummary && (
                <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    AI Manager Summary (Output)
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{selectedCase.managerSummary}</p>
                </div>
              )}

              {/* Policy chunks */}
              {selectedCase.retrievedChunks.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    Policy Chunks Retrieved ({selectedCase.retrievedChunks.length})
                  </p>
                  <div className="space-y-1">
                    {selectedCase.retrievedChunks.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md bg-violet-50 border border-violet-100 px-2.5 py-1.5"
                      >
                        <span className="text-[10px] font-mono text-violet-800">
                          {c.policyName} §{c.sectionRef}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-violet-200 rounded-full">
                            <div
                              className="h-1.5 bg-violet-500 rounded-full"
                              style={{ width: `${Math.round(c.score * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-violet-600">
                            {c.score.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      ) : null}

      {/* ── Advisory Banner ── */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
        <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
        <span>
          <strong>AI output is advisory only.</strong> All pipeline outputs, scores, and recommendations
          displayed here are generated by GPT-4o and validated by Zod schema. No automated
          action is taken on any case without explicit manager authorisation.
        </span>
      </div>
    </div>
  );
}

/* ─── Static Data ─── */

const PIPELINE_STEPS = [
  {
    label: "Case Intake",
    detail: "Complaint text + images + invoice submitted by CS agent",
    icon: <FileText className="size-4 text-blue-600" />,
    color: "bg-blue-50 border-blue-200",
  },
  {
    label: "Embedding",
    detail: "text-embedding-3-small encodes complaint into 768-dim vector",
    icon: <Cpu className="size-4 text-violet-600" />,
    color: "bg-violet-50 border-violet-200",
  },
  {
    label: "RAG Retrieval",
    detail: "pgvector cosine similarity retrieves top-5 policy chunks",
    icon: <FileSearch className="size-4 text-indigo-600" />,
    color: "bg-indigo-50 border-indigo-200",
  },
  {
    label: "GPT-4o",
    detail: "Multimodal analysis: complaint + images + PDFs + policy context",
    icon: <Brain className="size-4 text-emerald-600" />,
    color: "bg-emerald-50 border-emerald-200",
  },
  {
    label: "Zod Validation",
    detail: "Structured JSON output validated against schema; 1 repair retry",
    icon: <Shield className="size-4 text-amber-600" />,
    color: "bg-amber-50 border-amber-200",
  },
  {
    label: "RVS Scoring",
    detail: "Deterministic weighted formula cross-checks AI score",
    icon: <Target className="size-4 text-orange-600" />,
    color: "bg-orange-50 border-orange-200",
  },
  {
    label: "Recommendation",
    detail: "Final advisory output with manager summary stored to DB",
    icon: <CheckCircle2 className="size-4 text-slate-600" />,
    color: "bg-slate-50 border-slate-200",
  },
];

const MODEL_CONFIG = [
  { key: "Provider", value: "OpenAI API" },
  { key: "Model ID", value: "gpt-4o" },
  { key: "Capability", value: "Multimodal (text + image + PDF)" },
  { key: "Output Format", value: "JSON (responseMimeType)" },
  { key: "Retry Policy", value: "1 repair attempt on invalid JSON" },
  { key: "Input modalities", value: "Text, Images (JPEG/PNG/WEBP/HEIC), PDF" },
  { key: "Max context window", value: "1M tokens" },
  { key: "Rate limit", value: "500 RPM / 10K RPD" },
];

const EMBEDDING_CONFIG = [
  { key: "Embedding model", value: "text-embedding-3-small" },
  { key: "Vector dimensions", value: "768" },
  { key: "Vector store", value: "Neon Postgres + pgvector" },
  { key: "Similarity metric", value: "Cosine (1 - L2 distance)" },
  { key: "Top-K retrieval", value: "5 chunks" },
  { key: "Indexing command", value: "pnpm index-policies" },
  { key: "ORM", value: "Prisma with Neon adapter" },
  { key: "Validation", value: "Zod schema (aiAnalysisSchema)" },
];

const RVS_FACTORS = [
  {
    label: "Complaint Clarity",
    source: "complaint_analysis.clarity_score",
    weight: 0.20,
    color: "bg-blue-400",
    description: "How clearly the customer described the issue (AI-scored 0–100)",
  },
  {
    label: "Evidence Quality",
    source: "visual_analysis.evidence_quality_score",
    weight: 0.20,
    color: "bg-violet-400",
    description: "Quality of uploaded photographic evidence (0–100)",
  },
  {
    label: "Document Eligibility",
    source: "document_analysis (invoice + warranty + return window)",
    weight: 0.25,
    color: "bg-emerald-400",
    description: "Invoice valid (35%) + warranty active (35%) + within return window (30%)",
  },
  {
    label: "Policy Compliance",
    source: "policy_analysis.relevant_sections",
    weight: 0.25,
    color: "bg-amber-400",
    description: "Baseline (60%) + section count bonus (up to 20%) + conservative action bonus",
  },
  {
    label: "Historical Context",
    source: "Fixed at 50 for MVP",
    weight: 0.10,
    color: "bg-slate-400",
    description: "Placeholder for historical claims data; fixed at 50/100 in MVP",
  },
];

const SCORE_BANDS = [
  { range: "0–30", label: "Reject / More Evidence", bg: "bg-red-50", text: "text-red-700" },
  { range: "31–50", label: "Request Evidence", bg: "bg-amber-50", text: "text-amber-700" },
  { range: "51–70", label: "Troubleshoot / Technician", bg: "bg-blue-50", text: "text-blue-700" },
  { range: "71–85", label: "Escalate to Manager", bg: "bg-violet-50", text: "text-violet-700" },
  { range: "86–100", label: "Approve Replacement", bg: "bg-emerald-50", text: "text-emerald-700" },
];

const VISUAL_OUTPUTS = [
  { field: "visible_damage", type: "boolean", description: "Whether AI detects any visible physical damage in the images" },
  { field: "damage_type", type: "enum (7 values)", description: "scratch | dent | broken_part | leakage | packaging_damage | none_visible | unclear" },
  { field: "evidence_quality_score", type: "0–100", description: "Image clarity, lighting, angle, and coverage quality score" },
  { field: "serial_number_visible", type: "boolean", description: "Whether the product serial number label is visible in any image" },
  { field: "claim_image_consistency", type: "enum (3 values)", description: "supports_claim | does_not_support_claim | inconclusive" },
  { field: "visual_uncertainty", type: "string", description: "Free-text explanation of any visual ambiguity or limitations" },
];

const ZOD_SCHEMA_FIELDS = [
  {
    section: "complaint_analysis",
    bg: "bg-blue-50",
    fields: [
      { name: "category", type: "enum (5)" },
      { name: "severity", type: "enum (4)" },
      { name: "clarity_score", type: "0–100" },
      { name: "missing_evidence", type: "string[]" },
    ],
  },
  {
    section: "visual_analysis",
    bg: "bg-orange-50",
    fields: [
      { name: "visible_damage", type: "boolean" },
      { name: "damage_type", type: "enum (7)" },
      { name: "evidence_quality_score", type: "0–100" },
      { name: "serial_number_visible", type: "boolean" },
      { name: "claim_image_consistency", type: "enum (3)" },
      { name: "visual_uncertainty", type: "string" },
    ],
  },
  {
    section: "document_analysis",
    bg: "bg-emerald-50",
    fields: [
      { name: "invoice_valid", type: "bool | null" },
      { name: "warranty_status", type: "enum (3)" },
      { name: "return_window_status", type: "enum (3)" },
      { name: "product_value_aed", type: "number | null" },
      { name: "extracted_fields", type: "object (8 fields)" },
    ],
  },
  {
    section: "policy_analysis",
    bg: "bg-violet-50",
    fields: [
      { name: "relevant_sections", type: "string[] (min 1)" },
      { name: "policy_result", type: "string" },
    ],
  },
  {
    section: "Top-level Outputs",
    bg: "bg-slate-50",
    fields: [
      { name: "case_summary", type: "string" },
      { name: "contradictions", type: "string[]" },
      { name: "verified_facts", type: "string[]" },
      { name: "uncertainties", type: "string[]" },
      { name: "replacement_validity_score", type: "0–100" },
      { name: "recommended_action", type: "enum (6)" },
      { name: "manager_summary", type: "string" },
    ],
  },
  {
    section: "Validation & Safety",
    bg: "bg-amber-50",
    fields: [
      { name: "Schema", type: "Zod strict parse" },
      { name: "Retry on failure", type: "1 repair attempt" },
      { name: "Output mode", type: "JSON (responseMimeType)" },
      { name: "Score cross-check", type: "RVS weighted formula" },
      { name: "Drift threshold", type: "|delta| <= 20" },
    ],
  },
];

const RAG_STEPS = [
  { label: "Query construction", detail: "Product model + complaint text + requested action are concatenated into a retrieval query" },
  { label: "Query embedding", detail: "text-embedding-3-small encodes the query string into a 768-dimensional float vector" },
  { label: "Cosine similarity search", detail: "pgvector (Neon Postgres) computes 1 − (embedding <=> query_vector) for all policy chunks" },
  { label: "Top-5 selection", detail: "The 5 chunks with highest cosine similarity are selected and ranked" },
  { label: "Context injection", detail: "Selected chunks are serialized and injected into the GPT-4o prompt as [POLICY CONTEXT]" },
  { label: "Citation tracking", detail: "Chunk IDs and similarity scores are stored in aiAnalysis.retrievedChunks (JSON) for audit" },
];

/* ─── Sub-components ─── */

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
    </div>
  );
}

function StatPill({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="p-4 bg-white shadow-sm border-slate-200">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-900 font-mono">{value}</span>
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-100 text-emerald-700"
      : score >= 45
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

function AntiHallucinationPanel({
  agg,
  cases,
}: {
  agg: NonNullable<StatsData["antiHallucination"]>;
  cases: StatsData["caseDetails"];
}) {
  const casesWithEvidence = cases.filter((c) => c.evidenceInspected);
  const groundingRate =
    agg.totalCases > 0
      ? Math.round(((agg.totalCases - agg.casesWithGuards) / agg.totalCases) * 100)
      : 100;
  const fieldEntries = Object.entries(agg.guardEventsByField).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <Card className="p-5 bg-white shadow-sm border-2 border-emerald-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-2">
          <Shield className="size-5 text-emerald-600 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Anti-Hallucination Guards — Evidence Provenance
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
              Every AI score is traced back to the actual evidence that was
              inspected. PDFs are text-extracted via{" "}
              <code className="bg-slate-100 px-1 rounded text-[10px]">unpdf</code>;
              images are inspected by GPT-4o Vision. After the AI returns,
              deterministic guards null/zero any field whose underlying evidence
              was missing (e.g. <code className="text-[10px]">product_value_aed</code>{" "}
              cannot be set if no invoice text was extracted, regardless of what
              the AI tried to return).
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Cases analyzed</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{agg.totalCases}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-700">Grounding rate</p>
          <p className="text-lg font-bold text-emerald-900 tabular-nums">{groundingRate}%</p>
          <p className="text-[9px] text-emerald-700/80">cases needing no override</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-amber-700">Guards triggered</p>
          <p className="text-lg font-bold text-amber-900 tabular-nums">{agg.totalGuardEvents}</p>
          <p className="text-[9px] text-amber-700/80">across {agg.casesWithGuards} case(s)</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-blue-700">Images inspected</p>
          <p className="text-lg font-bold text-blue-900 tabular-nums">{agg.totalImagesInspected}</p>
          <p className="text-[9px] text-blue-700/80">via GPT-4o Vision</p>
        </div>
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-violet-700">PDF text extracted</p>
          <p className="text-lg font-bold text-violet-900 tabular-nums">
            {agg.totalPdfCharsExtracted.toLocaleString()}
          </p>
          <p className="text-[9px] text-violet-700/80">
            chars · {agg.totalScannedPdfs} scanned
          </p>
        </div>
      </div>

      {/* Guard events by field */}
      {fieldEntries.length > 0 ? (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Fields most often overridden by anti-hallucination guards
          </p>
          <div className="space-y-1">
            {fieldEntries.slice(0, 6).map(([field, count]) => (
              <div
                key={field}
                className="flex items-center gap-2 text-xs"
              >
                <code className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 min-w-[260px]">
                  {field}
                </code>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{
                      width: `${Math.min(100, (count / Math.max(...fieldEntries.map(([, c]) => c))) * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-bold tabular-nums text-slate-700 w-8 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 mb-4 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <p className="text-xs text-emerald-900">
            <strong>No guards triggered.</strong> Every AI output passed the
            evidence-source validation on the first try.
          </p>
        </div>
      )}

      {/* Per-case provenance table */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Per-case evidence inspection
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-2.5 py-2 font-semibold text-[10px] uppercase tracking-wide">
                  Case
                </th>
                <th className="text-center px-2.5 py-2 font-semibold text-[10px] uppercase tracking-wide">
                  Images
                </th>
                <th className="text-center px-2.5 py-2 font-semibold text-[10px] uppercase tracking-wide">
                  PDFs
                </th>
                <th className="text-center px-2.5 py-2 font-semibold text-[10px] uppercase tracking-wide">
                  PDF chars read
                </th>
                <th className="text-center px-2.5 py-2 font-semibold text-[10px] uppercase tracking-wide">
                  RVS
                </th>
                <th className="text-center px-2.5 py-2 font-semibold text-[10px] uppercase tracking-wide">
                  Guards
                </th>
                <th className="text-left px-2.5 py-2 font-semibold text-[10px] uppercase tracking-wide">
                  Override reasons (first 2)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {casesWithEvidence.map((c) => {
                const ei = c.evidenceInspected!;
                const events = ei.guardEvents;
                return (
                  <tr key={c.caseId} className="hover:bg-slate-50/70">
                    <td className="px-2.5 py-2">
                      <p className="font-medium text-slate-900">{c.customerName}</p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {c.productModel}
                      </p>
                    </td>
                    <td className="px-2.5 py-2 text-center tabular-nums">
                      {ei.imageCount > 0 ? (
                        <span className="inline-flex items-center rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold">
                          {ei.imageCount}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-center tabular-nums">
                      {ei.pdfCount > 0 ? (
                        <span className="inline-flex items-center rounded bg-violet-100 text-violet-800 px-1.5 py-0.5 text-[10px] font-bold">
                          {ei.pdfCount}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-center tabular-nums text-slate-600">
                      {ei.pdfCharsExtracted.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <ScoreChip score={c.score} />
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      {events.length > 0 ? (
                        <span className="inline-flex items-center rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">
                          {events.length}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold">
                          ✓
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2">
                      {events.length === 0 ? (
                        <span className="text-emerald-700 text-[10px]">
                          No overrides needed
                        </span>
                      ) : (
                        <ul className="space-y-0.5">
                          {events.slice(0, 2).map((ev, i) => (
                            <li key={i} className="text-[10px] text-slate-600">
                              <code className="font-mono text-amber-700">
                                {ev.field.split(".").pop()}
                              </code>
                              : {ev.reason}
                            </li>
                          ))}
                          {events.length > 2 && (
                            <li className="text-[10px] text-slate-400">
                              + {events.length - 2} more
                            </li>
                          )}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
              {casesWithEvidence.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2.5 py-6 text-center text-slate-400 text-xs">
                    No analyses with provenance data yet. Run a case through{" "}
                    <strong>analyze</strong> to populate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function DefectDetectionDiagram() {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 text-center">
        GPT-4o Vision Processing
      </p>
      {/* Simulated image analysis diagram */}
      <div className="relative rounded-lg border border-orange-300 bg-white p-3 overflow-hidden">
        <div className="grid grid-cols-3 gap-1 mb-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-square rounded bg-slate-200 flex items-center justify-center"
            >
              <Eye className="size-4 text-slate-400" />
            </div>
          ))}
        </div>
        {/* Detection boxes */}
        <div className="text-center text-[9px] text-orange-700 font-mono">
          <p>↓ GPT-4o Vision Analysis ↓</p>
        </div>
        <div className="grid grid-cols-2 gap-1 mt-1">
          {["Damage: dent", "Quality: 82/100", "Consistent: ✓", "Serial: visible"].map((label) => (
            <div
              key={label}
              className="rounded bg-orange-100 text-orange-800 text-[9px] font-mono px-1.5 py-1 text-center"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <div className="text-[9px] text-orange-700 text-center space-y-0.5">
        <p>Images → Base64 → GPT-4o</p>
        <p>→ Structured JSON output</p>
        <p>→ Zod validation → DB</p>
      </div>
    </div>
  );
}
