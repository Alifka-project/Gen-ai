# ReturnGuard AI

Multimodal RAG + human-in-the-loop decision support for product return validation.

A customer-service agent logs a return complaint with photos and an invoice. The platform retrieves the relevant company policy with vector search, sends the complaint plus the evidence to a multimodal LLM (Google Gemini Flash) in JSON mode, validates the structured output with Zod, recomputes a deterministic Replacement Validity Score, and presents a recommendation to a human manager — who always makes the final call.

> **AI output is advisory. Final decision belongs to the authorised manager.** (Banner rendered on every page.)

This repo is the 2-day MVP build of the original [project proposal](./Project%20Proposal%20Advanced%20Multi-modal%20Decision%20Support%20Customer%20Complaint.pdf). The detailed build spec lives in [`RETURNGUARD_BUILD_BRIEF.md`](./RETURNGUARD_BUILD_BRIEF.md).

## Stack

- **Next.js 14** App Router + TypeScript
- **Vercel** hosting + **Vercel Blob** storage
- **Neon Postgres** + **pgvector** (768-dim)
- **Prisma 6** ORM
- **Google Gemini 2.5 Flash** (multimodal, JSON mode) — `gemini-2.5-flash` by default; overridable via `GEMINI_MODEL`
- **`gemini-embedding-001`** for policy embeddings (truncated to 768 dims via `outputDimensionality`)
- **shadcn/ui** + Tailwind 3 + lucide-react + recharts
- **Zod 4** for LLM output validation
- Package manager: **pnpm**

## Workflow (matches proposal Figure 1 & 3)

```
Customer Complaint Text   ──┐
Product Image              ─┤   ┌─────────────────┐
Invoice/Delivery/Warranty  ─┼─► │  RAG retrieval  │ ──► Top-5 policy chunks
Return/Warranty Policy KB  ─┘   └─────────────────┘                │
                                                                    ▼
                                  ┌────────────────────────────────────┐
                                  │  Multimodal Gemini Flash (JSON)   │
                                  │  one call → Appendix-A structure  │
                                  └────────────────────────────────────┘
                                                  │
                          ┌───────────────────────┴─────────────────────────┐
                          ▼                                                 ▼
                   Zod validation                                    RVS recompute
                   (+ 1 repair retry)                                (sanity check)
                          │                                                 │
                          └────────────────┬────────────────────────────────┘
                                           ▼
                                  Replacement Validity Score (0-100)
                                           │
                                           ▼
                            Recommendation: approve | reject | request_evidence |
                                            remote_troubleshoot | send_technician |
                                            escalate
                                           │
                                           ▼
                          Human Manager Final Decision (logged to audit)
```

## Architecture (matches proposal Figure 2, layered)

| Layer | In this codebase |
|---|---|
| **User Interface Layer** — case intake, file upload, dashboard, manager decision | `app/cases/new/page.tsx`, `app/cases/[id]/page.tsx`, `components/case-intake-form.tsx`, `components/dashboard-tabs.tsx`, `components/decision-panel.tsx` |
| **Data Ingestion Layer** — complaint text, images, invoice, delivery, warranty, policy | `app/api/cases/route.ts`, `app/api/cases/[id]/upload/route.ts`, `data/policies/*.md` |
| **AI Processing Layer** — OCR, VLM, document extraction, embeddings, vector retrieval, LLM reasoning | `lib/ai/gemini.ts`, `lib/ai/embeddings.ts`, `lib/ai/retrieve.ts`, `lib/ai/index-policies.ts`, `lib/ai/analyze.ts` (Gemini reads PDFs + images natively — no separate OCR library) |
| **Evidence Fusion Layer** — combines visual, extracted fields, retrieved policy, risk factors | `lib/ai/analyze.ts` (orchestrator) + Appendix-A JSON shape in `lib/ai/schema.ts` |
| **Decision Support Layer** — RVS, recommendation, explanation, audit trail, human approval | `lib/ai/score.ts`, `components/score-card.tsx`, `components/decision-panel.tsx`, `lib/db/audit.ts` |
| **Storage & Governance Layer** — Postgres, object storage, vector DB, access control, logs | Neon Postgres + pgvector via `prisma/schema.prisma`, Vercel Blob, `model AuditLog`, `components/governance-banner.tsx` |

## PDF section → code mapping

| Proposal § | Topic | Where in code |
|---|---|---|
| §1 Executive Summary | Pitch | `README.md` + `presentation/slides.md` |
| §3 Business Problem | Cost leakage | `presentation/slides.md` slide 1, `lib/cost.ts` |
| §4 Proposed Solution | Web platform | Whole `app/` |
| §5.2 Specific Objectives 1-7 | Case intake, doc intel, image analysis, RAG, RVS, explainability, evaluation | each maps to a file (see brief §18) |
| §5.3 RQ1-RQ5 | Research questions | answered by `scripts/run-evaluation.ts` → `evaluation-report.md` |
| §6.1 Multimodal Learning | Text + image + doc | single multimodal call in `lib/ai/analyze.ts` |
| §6.2 RAG | Chunk + embed + retrieve | `lib/ai/index-policies.ts` + `lib/ai/retrieve.ts` |
| §6.3 Human-in-the-Loop | Manager always final | `components/decision-panel.tsx` + `ManagerDecision` table |
| §6.4 Evidence Fusion | Structured JSON | `lib/ai/schema.ts` (Zod) + JSONB columns |
| §7 Model Foundations | Hybrid track | Gemini 2.0 Flash hosted; pre-trained, no training needed |
| §8 System Architecture | 6 layers | See table above |
| §9 End-to-End Workflow | 8-step case flow | wired across `app/api/cases/**` |
| §10 Modules A-F | 6 conceptual modules | folded into single Gemini call producing one Appendix-A JSON (see `lib/ai/schema.ts`) |
| Catalogue alignment | Bosch + Samsung product list | `data/products/catalogue.ts` (28 SKUs) extracted from `Bosch washing machine catalogue.pdf` + `Samsung catalogue.pdf`; surfaced at `/products`. Case intake is restricted to these model codes (Zod refine in `lib/catalogue.ts` enforces it both client-side via the dropdown and server-side in POST `/api/cases`). The Gemini prompt receives the catalogue product context as a grounding block (brand, series, capacity, RPM, estimated retail value), so the analysis is model-aware rather than brand-agnostic. |
| §11.2 Chunking | 300-600 tokens, 50-100 overlap | by-section split in `lib/ai/index-policies.ts` |
| §11.3 Retrieval Formula | Cosine similarity | pgvector `<=>` operator in `lib/ai/retrieve.ts` |
| §11.4 RAG Guardrails | 5 safety rules | `SYSTEM_PROMPT` in `lib/ai/prompts.ts` + Zod `relevant_sections.min(1)` |
| §12.1 RVS formula | Weighted score | `computeRVS()` in `lib/ai/score.ts` |
| §12.2 Recommendation thresholds | 0-30/31-50/51-70/71-85/86-100 | `thresholdSanityCheck()` in `lib/ai/score.ts`; flag shown in `ScoreCard` |
| §12.3 Contradiction handling | Flag inconsistencies | `contradictions[]` field + red banner in `app/cases/[id]/page.tsx` (case **C007** demo) |
| §13.2 Demo case labels | C001-C005 (+ C006-C008) | `data/demo-cases/c00*/expected.json` + `prisma/seed.ts` |
| §14.1 Database tables | 7 tables | `prisma/schema.prisma` — 6 explicit models (`Case`, `Document`, `PolicyChunk`, `AiAnalysis`, `ManagerDecision`, `AuditLog`); `case_images` and `extracted_fields` folded into JSONB columns |
| §15.1 API endpoints | 8 routes | `app/api/**/route.ts` (both `/api/policies/index` and `/api/policies/reindex` route to the same handler) |
| §15.2 Backend orchestration | `analyze_case(case_id)` pseudocode | `lib/ai/analyze.ts` follows the same shape |
| §16.1 Login/Role Selection | CS vs manager roles | `components/role-switcher.tsx` (header dropdown, localStorage); enforced soft by `DecisionPanel` |
| §16.2 UI design principles | Top score, tabs, color rules | `components/score-card.tsx`, `components/dashboard-tabs.tsx`, `components/recommendation-badge.tsx` |
| §16.3 Dashboard layout | Score + tabs + decision | `app/cases/[id]/page.tsx` |
| §17 Roadmap | 8 phases | compressed into brief §28 (8 phases × 2-day MVP) |
| §18 Prompt Engineering | Schema + repair loop | `lib/ai/prompts.ts` + retry in `lib/ai/analyze.ts` |
| §19 Evaluation Methodology | 7 metrics | `scripts/run-evaluation.ts` → `evaluation-report.md` |
| §20 Cost-Saving Model | 150+80+100+OpenBox AED | `lib/cost.ts`, surfaced on `/analytics` and dashboard "Cost" tab |
| §21 Deployment + Security | Vercel + 6 controls | README "Deploying" + `app/api/cases/[id]/upload/route.ts` mime/size validation |
| §21.2 Audit logging | `audit_logs` table | `model AuditLog` + `lib/db/audit.ts`, called on case create / upload / analyze / decision / reindex |
| §21.3 Governance principle | "Advisory only" banner | `components/governance-banner.tsx` in `app/layout.tsx` |
| §22 Risks & Mitigations | 8 risks | brief §26, surfaced in slides slide 7 |
| §23 Deliverables | 7 outputs | brief §27 checklist; all present in repo |
| Appendix A | Output JSON schema | `aiAnalysisSchema` in `lib/ai/schema.ts` |
| Appendix B | SQL schema | `prisma/schema.prisma` (vector dim 768 vs proposal's 1536 — we use Google `gemini-embedding-001` truncated to 768 via `outputDimensionality`) |
| Appendix C | 3 example prompts | consolidated into one master prompt in `lib/ai/prompts.ts` |

## Local setup

### 1. Prerequisites

- Node 20+ (verified on 24.1.0).
- `pnpm` — install with `corepack enable && corepack prepare pnpm@latest --activate` (no sudo).

### 2. Clone and install

```bash
git clone https://github.com/Alifka-project/Gen-ai.git
cd Gen-ai
pnpm install
```

### 3. Set environment variables

```bash
cp .env.example .env
cp .env.example .env.local   # Next.js dev runtime reads this
```

| Variable | Where to get |
|---|---|
| `DATABASE_URL` | [neon.tech](https://neon.tech) → create project → copy connection string |
| `GEMINI_API_KEY` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) (free tier covers MVP) |
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard → Storage → Blob (or `vercel env pull .env.local` after linking) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev |

Optional overrides: `GEMINI_MODEL` (default `gemini-2.5-flash` — gives 250 RPD on free tier) and `GEMINI_EMBEDDING_MODEL` (default `gemini-embedding-001`). `gemini-flash-latest` resolves to a preview model with only 20 RPD; not recommended.

### 4. Enable pgvector and migrate

In the Neon SQL editor, once:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then apply the schema:

```bash
pnpm prisma migrate dev --name init
pnpm db:test    # 1-row roundtrip sanity check
```

### 5. Index policies and seed demo cases

```bash
pnpm index-policies    # embed data/policies/*.md into PolicyChunk (9 chunks)
pnpm seed              # insert the 8 demo cases from brief §9
```

### 6. Run

```bash
pnpm dev
# → open http://localhost:3000
```

### 7. Optional — run the evaluation

```bash
pnpm evaluate          # runs all 8 cases through Gemini, writes evaluation-report.md
```

## Demo flow (5 minutes)

1. Open `/` — the 8 seeded cases.
2. Switch the **role** in the header to "Manager" (so Approve/Reject are unlocked).
3. Click **demo-c007** (the hero contradiction case). Optionally attach a real undamaged-unit photo for maximum effect.
4. Click **Run analysis** — wait ~10-25 seconds. The pipeline:
   - retrieves the top 5 policy chunks via pgvector cosine,
   - sends the complaint + any uploaded files to Gemini Flash in JSON mode,
   - validates the response with Zod (retries once on invalid JSON),
   - recomputes the weighted RVS as a sanity check,
   - persists the `AiAnalysis` + `AuditLog` rows.
5. Read the **manager summary**, the **contradictions banner** (red), the **verified facts** (green), the **uncertainties** (amber), and walk through the five tabs.
6. Click a decision button at the bottom (e.g. **Request evidence**), add a manager note, **Submit decision** — the case becomes `decided` and shows up coloured on the home table.
7. Visit `/analytics` for counts + projected monthly saving.
8. Visit `/policies` to see the indexed policy chunks the RAG layer retrieves from.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Local dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm tsc --noEmit` | Type-check only |
| `pnpm prisma migrate dev` | Apply schema migration |
| `pnpm prisma studio` | DB inspector |
| `pnpm seed` | Insert 8 demo cases |
| `pnpm index-policies` | Re-embed policy markdown |
| `pnpm db:test` | DB connectivity smoke test |
| `pnpm evaluate` | Run all 8 demo cases through `analyzeCase()` and write `evaluation-report.md` |

## Deploying to Vercel

```bash
# 1. Push to GitHub (the repo is wired to origin)
git push -u origin main

# 2. Import the repo at vercel.com → New Project
# 3. Add these environment variables in Project Settings → Environment Variables:
#    DATABASE_URL, GEMINI_API_KEY, NEXT_PUBLIC_APP_URL (= your Vercel URL)
# 4. Add Vercel Blob (Storage tab) — BLOB_READ_WRITE_TOKEN auto-injects.
# 5. Deploy. After first deploy, against the same Neon URL run locally:
#      pnpm prisma migrate deploy   (one-time, applies tables in production)
#      pnpm index-policies          (or POST /api/policies/reindex once live)
#      pnpm seed                    (insert demo cases)
```

The `next.config.mjs` includes the policy markdown files in the `/api/policies/reindex` route bundle via `outputFileTracingIncludes`, so the HTTP reindex works on Vercel.

## Model training — required?

**No, no training is required.** Per proposal §7 and §7.1, the project uses pre-trained foundation models:

- **Gemini 2.5 Flash** for the multimodal reasoning call (hosted, no training)
- **`gemini-embedding-001`** for policy embeddings (hosted, no training; truncated to 768 dims)

The only "training-like" step is `pnpm index-policies`, which embeds the 9 policy chunks once and stores the vectors in `PolicyChunk.embedding`. This takes ~5 seconds and runs against Gemini's hosted embedding API.

Optional future work (proposal §7 candidate: "supervised classifier after dataset grows"): once we have hundreds of `ManagerDecision` rows, we could train a lightweight classifier to predict `recommended_action` from the structured features, then ensemble it with the LLM output for additional robustness. This is out of MVP scope.

## What's in vs out of scope (MVP honesty box)

| In scope (built) | Out of scope (future work) |
|---|---|
| 8 demo cases | 50-100 case dataset (proposal §13) |
| Synthetic policies + invoices | Real client policy ingestion |
| Single Gemini call returning the full Appendix-A JSON | Per-module calls (A-F separately) |
| Hardcoded role dropdown | NextAuth + real role-based access |
| In-memory cosine works, but pgvector is used for the demo | Reranker, hybrid BM25 + vector |
| Background jobs synchronous (~20s spinner) | Queue + webhooks for large batches |
| Single grader on expected labels | Inter-annotator agreement (proposal §19.4) |
| Audit log table + writes; no UI yet | Audit-log explorer page |

See brief §17 and §28 for the full proposal-coverage matrix.

## Team

- **Alif** — AI pipeline (`lib/ai/`), prompts, evaluation, report
- **Shahansha** — Backend (API routes, Prisma, deployment)
- **Vishal** — Frontend (pages, dashboard, slides, dataset polish)

## Limitations + governance

- AI output is **advisory only**. The persistent banner is in `app/layout.tsx`; never remove it.
- For functional defects (no cooling, vibration, noise, electrical, software), prompt rule #3 prevents `approve_replacement` on photos alone — it must route to remote troubleshoot / technician / more evidence.
- Every recommendation must cite ≥1 policy section (enforced by Zod `relevant_sections.min(1)`).
- LLM outputs are JSON-validated; one repair retry on invalid JSON. If still invalid, the case stays in `new` and the UI surfaces the validation error.
- All actions (create / upload / analyze / decision / reindex) write to the `AuditLog` table for traceability per proposal §21.2.
- Synthetic data only — no real customer PII is in this repo.

## License

MIT (academic project context). Synthetic data may be reused.
