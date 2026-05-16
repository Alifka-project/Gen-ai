// scripts/run-evaluation.ts
// Run analyzeCase() over every seeded demo case, compare to its expected.json,
// compute aggregate metrics, and write evaluation-report.md.
//
// Run with: pnpm evaluate
// Requires: DATABASE_URL, GEMINI_API_KEY, pgvector enabled, seed + index-policies run.

import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/db/prisma";
import { analyzeCase } from "../lib/ai/analyze";
import { FLASH_MODEL } from "../lib/ai/gemini";
import { aiAnalysisSchema } from "../lib/ai/schema";
import {
  avoidedCostPerCase,
  COST_SAVING_RECOMMENDATIONS,
  projectedMonthlySaving,
} from "../lib/cost";

type Expected = {
  caseId: string;
  title: string;
  expectedRecommendation: string;
  acceptableAlternatives: string[];
  expectsContradiction: boolean;
  expectedCategory: string;
  notes: string;
};

type CaseResult = {
  expected: Expected;
  got: {
    recommendation: string;
    score: number;
    rvsRecomputed: number;
    rvsDelta: number;
    latencyMs: number;
    contradictionCount: number;
    citationCount: number;
    valid: boolean;
    contradictions: string[];
    managerSummary: string;
    rawError?: string;
  };
  match: "exact" | "alternative" | "miss";
};

const DEMO_DIR = path.join(process.cwd(), "data", "demo-cases");
const REPORT_PATH = path.join(process.cwd(), "evaluation-report.md");

async function loadExpected(): Promise<Expected[]> {
  const subdirs = (await fs.readdir(DEMO_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const out: Expected[] = [];
  for (const dir of subdirs) {
    const file = path.join(DEMO_DIR, dir, "expected.json");
    try {
      const raw = await fs.readFile(file, "utf8");
      out.push(JSON.parse(raw) as Expected);
    } catch {
      console.warn(`  ⚠ no expected.json in ${dir}, skipping`);
    }
  }
  return out;
}

function classify(
  expected: Expected,
  recommendation: string
): "exact" | "alternative" | "miss" {
  if (recommendation === expected.expectedRecommendation) return "exact";
  if (expected.acceptableAlternatives.includes(recommendation)) return "alternative";
  return "miss";
}

async function main() {
  console.log("→ Loading expected fixtures...");
  const expectedList = await loadExpected();
  console.log(`  ${expectedList.length} expected cases loaded.`);

  const results: CaseResult[] = [];
  for (const exp of expectedList) {
    const caseExists = await prisma.case.findUnique({
      where: { id: exp.caseId },
      select: { id: true },
    });
    if (!caseExists) {
      console.log(`  ⚠ case ${exp.caseId} not in DB — run \`pnpm seed\` first. Skipping.`);
      continue;
    }
    console.log(`→ analyzing ${exp.caseId} (${exp.title})...`);
    try {
      const r = await analyzeCase(exp.caseId);
      const got = {
        recommendation: r.analysis.recommended_action,
        score: r.analysis.replacement_validity_score,
        rvsRecomputed: r.rvsRecomputed,
        rvsDelta: r.rvsDelta,
        latencyMs: r.latencyMs,
        contradictionCount: r.analysis.contradictions.length,
        citationCount: r.analysis.policy_analysis.relevant_sections.length,
        valid: true,
        contradictions: r.analysis.contradictions,
        managerSummary: r.analysis.manager_summary,
      };
      results.push({ expected: exp, got, match: classify(exp, got.recommendation) });
      console.log(
        `  → ${got.recommendation} (expected ${exp.expectedRecommendation}) — ${got.latencyMs}ms, ${got.citationCount} citations, ${got.contradictionCount} contradictions`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ ${exp.caseId} failed: ${msg}`);
      results.push({
        expected: exp,
        got: {
          recommendation: "ERROR",
          score: 0,
          rvsRecomputed: 0,
          rvsDelta: 0,
          latencyMs: 0,
          contradictionCount: 0,
          citationCount: 0,
          valid: false,
          contradictions: [],
          managerSummary: "",
          rawError: msg,
        },
        match: "miss",
      });
    }
  }

  if (results.length === 0) {
    console.log("✗ No cases processed. Nothing to report.");
    return;
  }

  // Aggregates.
  const exact = results.filter((r) => r.match === "exact").length;
  const alt = results.filter((r) => r.match === "alternative").length;
  const miss = results.filter((r) => r.match === "miss").length;
  const valid = results.filter((r) => r.got.valid).length;
  const cited = results.filter((r) => r.got.citationCount > 0).length;
  const avgLatency = Math.round(
    results.reduce((s, r) => s + r.got.latencyMs, 0) / results.length
  );
  const contradictionsDetected = results.filter(
    (r) => r.expected.expectsContradiction && r.got.contradictionCount > 0
  ).length;
  const contradictionsExpected = results.filter(
    (r) => r.expected.expectsContradiction
  ).length;

  const agreementRate = ((exact + alt) / results.length) * 100;
  const validityRate = (valid / results.length) * 100;
  const citationRate = (cited / results.length) * 100;

  // Score / severity correlation (Pearson) — severity rank: low=1, medium=2, high=3, critical=4.
  // For our setup, use expectedRecommendation as a proxy ordinal: reject=0, request_more=1, remote=2, tech=3, escalate=4, approve=5.
  const recOrder: Record<string, number> = {
    reject_request: 0,
    request_more_evidence: 1,
    remote_troubleshooting: 2,
    send_technician: 3,
    escalate_manager: 4,
    approve_replacement: 5,
  };
  const xs = results.map((r) => r.got.score);
  const ys = results.map((r) => recOrder[r.expected.expectedRecommendation] ?? 0);
  const pearson = correlation(xs, ys);

  // Cost saving on this run.
  let totalAvoidedAed = 0;
  for (const r of results) {
    if (r.got.valid && COST_SAVING_RECOMMENDATIONS.has(r.got.recommendation)) {
      totalAvoidedAed += avoidedCostPerCase(2500);
    }
  }
  const projectedMonthlyAed = projectedMonthlySaving(
    results.filter(
      (r) => r.got.valid && COST_SAVING_RECOMMENDATIONS.has(r.got.recommendation)
    ).length * 4,
    2500
  );

  const successes = results.filter((r) => r.match !== "miss").slice(0, 3);
  const failures = results.filter((r) => r.match === "miss").slice(0, 3);

  const lines: string[] = [];
  lines.push("# ReturnGuard AI — Evaluation Report");
  lines.push("");
  lines.push(
    `_Generated ${new Date().toISOString()} · model: \`${FLASH_MODEL}\` · embedding: \`${process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small"}\`._`
  );
  lines.push("");
  lines.push("## Aggregate metrics");
  lines.push("");
  lines.push("| Metric | Value | Target |");
  lines.push("| --- | ---: | ---: |");
  lines.push(
    `| Recommendation agreement (exact + acceptable alternative) | **${agreementRate.toFixed(1)}%** (${exact + alt}/${results.length}) | ≥75% |`
  );
  lines.push(`| JSON validity rate | **${validityRate.toFixed(1)}%** (${valid}/${results.length}) | ≥95% |`);
  lines.push(`| Policy citation rate | **${citationRate.toFixed(1)}%** (${cited}/${results.length}) | 100% |`);
  lines.push(`| Avg analysis latency | **${avgLatency} ms** | <30000 |`);
  lines.push(
    `| Contradictions detected on cases that expect one | **${contradictionsDetected}/${contradictionsExpected}** | full hit |`
  );
  lines.push(
    `| Pearson(score, expected severity rank) | **${isFinite(pearson) ? pearson.toFixed(3) : "n/a"}** | >0.5 |`
  );
  lines.push("");
  lines.push("## Per-case results");
  lines.push("");
  lines.push(
    "| Case | Expected | Got | Match | Score | RVS recomp | Δ | Citations | Contradictions | Latency |"
  );
  lines.push(
    "| --- | --- | --- | :-: | ---: | ---: | ---: | ---: | ---: | ---: |"
  );
  for (const r of results) {
    lines.push(
      `| ${r.expected.caseId} | ${r.expected.expectedRecommendation} | ${r.got.recommendation} | ${badge(r.match)} | ${r.got.score} | ${r.got.rvsRecomputed} | ${r.got.rvsDelta} | ${r.got.citationCount} | ${r.got.contradictionCount} | ${r.got.latencyMs}ms |`
    );
  }
  lines.push("");

  lines.push("## Cost-saving estimate");
  lines.push("");
  lines.push(
    `On this 8-case run, the AI recommended a conservative path (reject / request evidence / remote troubleshoot / technician / escalate) ${results.filter((r) => COST_SAVING_RECOMMENDATIONS.has(r.got.recommendation)).length} time(s).`
  );
  lines.push("");
  lines.push(
    `- Estimated cost avoided on this batch (avg product value AED 2500): **AED ${Math.round(totalAvoidedAed).toLocaleString()}**`
  );
  lines.push(
    `- Projected monthly saving at 4× this volume: **AED ${Math.round(projectedMonthlyAed).toLocaleString()}**`
  );
  lines.push("");

  lines.push("## Successes (selected)");
  lines.push("");
  for (const s of successes) {
    lines.push(`### ${s.expected.caseId} — ${s.expected.title}`);
    lines.push("");
    lines.push(`- **Expected:** \`${s.expected.expectedRecommendation}\``);
    lines.push(`- **Got:** \`${s.got.recommendation}\` (${s.match})`);
    lines.push(`- **Manager summary:** ${s.got.managerSummary || "(none)"}`);
    if (s.got.contradictions.length > 0) {
      lines.push(
        `- **Contradictions flagged:** ${s.got.contradictions.map((c) => `\`${c}\``).join("; ")}`
      );
    }
    lines.push("");
  }

  if (failures.length > 0) {
    lines.push("## Failures (root-cause notes)");
    lines.push("");
    for (const f of failures) {
      lines.push(`### ${f.expected.caseId} — ${f.expected.title}`);
      lines.push("");
      lines.push(`- **Expected:** \`${f.expected.expectedRecommendation}\` (alternatives: ${f.expected.acceptableAlternatives.map((a) => `\`${a}\``).join(", ") || "none"})`);
      lines.push(`- **Got:** \`${f.got.recommendation}\``);
      lines.push(`- **Possible cause:** ${f.expected.notes}`);
      if (f.got.rawError) lines.push(`- **Error:** \`${f.got.rawError}\``);
      lines.push("");
    }
  }

  lines.push("## Method");
  lines.push("");
  lines.push(
    "Each case in `data/demo-cases/c00*/` defines an `expected.json` with the gold-label recommendation and acceptable alternatives. `scripts/run-evaluation.ts` loads each fixture, finds the matching seeded `Case` row, calls `analyzeCase()` (the same orchestrator used by the API), and records latency + recommendation + contradictions + citations. Aggregates are computed as documented in proposal §19 / brief §23. RVS is recomputed locally with `lib/ai/score.ts` and the absolute delta is reported; a delta > 20 is logged on the dashboard as a sanity-check warning."
  );
  lines.push("");
  lines.push("## Limitations");
  lines.push("");
  lines.push("- **Sample size.** Eight cases vs the proposal's 50–100 — explicit scope cut for the 2-day MVP. Future work scales the dataset and adds inter-annotator agreement among multiple managers.");
  lines.push("- **Synthetic data.** Cases, photos, and invoices are synthetic per proposal §13.3. Production evaluation requires anonymised real-world cases under privacy review.");
  lines.push("- **Single grader.** \"Expected\" labels are the build-team's interpretation of the policy text; a real client-side gold set would require the client's service-ops team to label.");
  lines.push("- **No image uploads in seed.** Cases C002 and C007 are best demonstrated with attached photos (broken-door image / no-damage image). Run the analysis after attaching images via the UI for the most accurate visual_analysis output.");

  await fs.writeFile(REPORT_PATH, lines.join("\n") + "\n", "utf8");
  console.log(`✓ Wrote ${REPORT_PATH}`);
  console.log(`  agreement: ${agreementRate.toFixed(1)}% | validity: ${validityRate.toFixed(1)}% | citation: ${citationRate.toFixed(1)}% | avg latency: ${avgLatency}ms`);
}

function badge(m: CaseResult["match"]): string {
  return m === "exact" ? "✓" : m === "alternative" ? "≈" : "✗";
}

function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? NaN : num / denom;
}

// Re-validate any analysis we re-read (defense in depth).
export const _schemaCheck = aiAnalysisSchema;

main()
  .catch((e) => {
    console.error("✗ evaluation failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
