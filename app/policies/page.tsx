import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/card";
import { BookOpen, Hash, Tag, RefreshCw, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

const POLICY_DESCRIPTIONS: Record<string, string> = {
  "Return Policy":
    "Governs the return window, damage rules, open-unit classification, and return eligibility criteria for all home appliance sales.",
  "Replacement Policy":
    "Defines approval matrix, cost implications, open-box depreciation, and the process for authorising product replacement.",
  "Warranty Policy":
    "Covers manufacturer warranty duration, exclusions, and the functional fault resolution process including technician dispatch.",
  "UAE Consumer Protection Policy":
    "Incorporates obligations under UAE Federal Law No. 15/2020, statutory return entitlements, warranty minimums, and consumer escalation rights.",
  "Electronics & Appliance Damage Assessment Policy":
    "Internal framework for classifying damage (DOA, transit, installation, misuse, cosmetic), evidence standards, and AI-assisted image analysis thresholds.",
  "Extended Warranty & After-Sales Service Policy":
    "Extended warranty program tiers, out-of-warranty service rates, authorised service network, spare parts guarantee, and PMC contracts.",
  "Refund & Credit Note Policy":
    "Governs full/partial refund eligibility, credit note issuance terms, refund processing timelines, high-value escalation, and AI integration for refund decisions.",
};

const POLICY_ICONS: Record<string, React.ReactNode> = {
  "Return Policy": <Shield className="size-5 text-blue-600" />,
  "Replacement Policy": <RefreshCw className="size-5 text-violet-600" />,
  "Warranty Policy": <Shield className="size-5 text-emerald-600" />,
  "UAE Consumer Protection Policy": <Shield className="size-5 text-red-600" />,
  "Electronics & Appliance Damage Assessment Policy": <Shield className="size-5 text-orange-600" />,
  "Extended Warranty & After-Sales Service Policy": <Shield className="size-5 text-indigo-600" />,
  "Refund & Credit Note Policy": <Shield className="size-5 text-teal-600" />,
};

const RULE_TYPE_COLORS: Record<string, string> = {
  technician_required: "bg-violet-100 text-violet-700",
  open_box_depreciation: "bg-amber-100 text-amber-700",
  warranty_exclusion: "bg-red-100 text-red-700",
  functional_fault_process: "bg-blue-100 text-blue-700",
  damage_classification: "bg-orange-100 text-orange-700",
  uae_law: "bg-emerald-100 text-emerald-700",
  escalation_required: "bg-red-100 text-red-700",
  evidence_standard: "bg-slate-100 text-slate-700",
};

export default async function PoliciesPage() {
  let chunks: Awaited<ReturnType<typeof loadChunks>> = [];
  let loadError: string | null = null;
  try {
    chunks = await loadChunks();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "failed to load chunks";
  }

  const grouped = new Map<string, typeof chunks>();
  for (const c of chunks) {
    const list = grouped.get(c.policyName) ?? [];
    list.push(c);
    grouped.set(c.policyName, list);
  }

  const totalChunks = chunks.length;
  const totalPolicies = grouped.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 mt-0.5">
            <BookOpen className="size-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Policy Knowledge Base
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Chunked and vector-embedded policy documents used by the RAG
              pipeline during AI analysis.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalPolicies}</p>
            <p className="text-xs text-slate-400">Policies</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalChunks}</p>
            <p className="text-xs text-slate-400">Indexed chunks</p>
          </div>
        </div>
      </div>

      {/* How RAG works */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2.5">
          <Hash className="size-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-1">
              How policy retrieval works
            </p>
            <p className="text-xs text-blue-800 leading-relaxed">
              Each policy section is chunked and embedded using{" "}
              <strong>gemini-embedding-001</strong> (768 dimensions) and stored in{" "}
              <strong>Neon pgvector</strong>. When a case is analyzed, the complaint
              text and product context are embedded and the top-5 most semantically
              similar policy chunks are retrieved via cosine similarity. These chunks
              are injected into the Gemini 2.0 Flash prompt as grounding context, so
              the AI recommendation is always policy-grounded. Re-index by running{" "}
              <code className="bg-blue-200 px-1 rounded text-[11px]">pnpm index-policies</code>{" "}
              after editing the markdown files in{" "}
              <code className="bg-blue-200 px-1 rounded text-[11px]">data/policies/</code>.
            </p>
          </div>
        </div>
      </Card>

      {/* Error */}
      {loadError ? (
        <Card className="p-6 border-red-300 bg-red-50 text-sm text-red-900">
          <p className="font-medium">Could not load policy chunks.</p>
          <p className="font-mono text-xs mt-1">{loadError}</p>
        </Card>
      ) : chunks.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-white">
          <BookOpen className="size-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No policy chunks indexed yet.</p>
          <p className="text-sm text-slate-400 mt-1">
            Run{" "}
            <code className="bg-slate-100 px-1 rounded">pnpm index-policies</code> to
            chunk and embed <code className="bg-slate-100 px-1 rounded">data/policies/*.md</code>.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([policy, list]) => (
            <PolicyCard
              key={policy}
              policyName={policy}
              chunks={list}
              description={POLICY_DESCRIPTIONS[policy]}
              icon={POLICY_ICONS[policy]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PolicyCard({
  policyName,
  chunks,
  description,
  icon,
}: {
  policyName: string;
  chunks: { id: string; sectionRef: string; ruleType: string | null; chunkText: string }[];
  description?: string;
  icon?: React.ReactNode;
}) {
  const sorted = [...chunks].sort((a, b) => a.sectionRef.localeCompare(b.sectionRef));

  return (
    <Card className="bg-white shadow-sm border-slate-200 overflow-hidden">
      {/* Policy header */}
      <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
            {icon ?? <BookOpen className="size-4 text-slate-500" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{policyName}</h2>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
          <Tag className="size-3.5" />
          <span className="font-medium">{chunks.length} sections</span>
        </div>
      </div>

      {/* Section list */}
      <div className="divide-y divide-slate-100">
        {sorted.map((chunk) => (
          <div key={chunk.id} className="p-4 hover:bg-slate-50/60 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 text-white text-[10px] font-mono font-medium px-1.5 py-0.5">
                  §{chunk.sectionRef}
                </span>
                {chunk.ruleType && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      RULE_TYPE_COLORS[chunk.ruleType] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {chunk.ruleType.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <pre className="text-xs whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                {chunk.chunkText.replace(/^#{1,3}.+\n+/, "").trim()}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

async function loadChunks() {
  return prisma.policyChunk.findMany({
    select: {
      id: true,
      policyName: true,
      sectionRef: true,
      ruleType: true,
      chunkText: true,
    },
    orderBy: [{ policyName: "asc" }, { sectionRef: "asc" }],
  });
}
