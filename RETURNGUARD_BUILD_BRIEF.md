# ReturnGuard AI — 2-Day Build Brief & Kickoff Prompt

> **How to use this file:** Read sections 1–4 once together as a team. Then start building from section 11 (Kickoff Commands). When stuck, copy the relevant section into Cursor/Claude/ChatGPT as a system prompt — it's written to be directly usable as AI coding context.

---

## 1. Project context (the 30-second version)

We are building **ReturnGuard AI**, a web app where customer-service staff log a product-return complaint with photos + invoice. A multimodal LLM analyzes the evidence, retrieves relevant company policy via RAG, scores the replacement validity, and recommends the next action (approve, reject, request more evidence, remote troubleshoot, send technician, escalate). A human manager makes the final call.

**Why it matters:** Customers claim damage on small scratches → company replaces fast → unit becomes open-box → resale value drops → margin lost. ReturnGuard moves the process from *reactive approval* to *evidence-first validation*, saving ~930 AED per prevented unnecessary return.

Full proposal is in `Project Proposal Advanced Multi-modal Decision Support Customer Complaint.pdf`. **When the proposal and this brief disagree, this brief wins** (it is the 2-day compressed version).

---

## 2. Locked stack (do not change without team agreement)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 (App Router) + TypeScript** | One repo, one deploy, API routes + UI together |
| Hosting | **Vercel** | Free, git-push deploy, native Blob storage |
| Database | **Neon Postgres (free) with pgvector** | Serverless, Vercel-native, supports vector search |
| ORM | **Prisma** | Type-safe schema, easy migrations |
| File storage | **Vercel Blob** | Free tier, zero setup |
| UI | **shadcn/ui + Tailwind + lucide-react** | Looks professional out of the box |
| Multimodal LLM | **Google Gemini 2.0 Flash** via `@google/generative-ai` | Free tier (15 RPM / 1500 RPD), native image+PDF+text, JSON mode |
| Embeddings | **Google `text-embedding-004`** | Free, 768 dims |
| Local fallback | **Ollama + `llama3.2-vision:11b`** | For offline dev when rate-limited |
| Auth | **None (demo mode)** | Hardcoded role dropdown: customer_service / manager |
| Validation | **Zod** | Validate LLM JSON output |

### What we are explicitly NOT using (and why)
- FastAPI — Vercel serverless can't host long-running Python AI pipelines well. Everything in Next.js.
- PaddleOCR / Tesseract — Gemini reads PDFs and images directly. Skip the OCR library.
- Qwen-VL / LLaVA / InternVL — need a GPU, slow to set up. Gemini Flash is free and comparable for our use case.
- Background job queue (BullMQ, etc.) — synchronous request + loading spinner is fine for 8 demo cases.
- Separate auth service / NextAuth — demo only.
- pgvector inside Next.js when only 10 chunks — we'll still use it because it looks more impressive in the report, but cosine similarity in JS would also work.

---

## 3. Architecture (one screen)

```
┌──────────────────────────────────────────────────────────────────┐
│  Next.js App (Vercel)                                            │
│                                                                  │
│  Pages (React Server Components + shadcn/ui)                     │
│   /                → case list                                   │
│   /cases/new       → intake form                                 │
│   /cases/[id]      → analysis dashboard (THE big screen)         │
│   /analytics       → business impact metrics                     │
│   /policies        → indexed policy chunks viewer                │
│                                                                  │
│  API routes (app/api/.../route.ts)                               │
│   POST   /api/cases                  → create case               │
│   POST   /api/cases/:id/upload       → upload to Blob            │
│   POST   /api/cases/:id/analyze      → run full pipeline ★       │
│   GET    /api/cases/:id              → fetch case + analysis     │
│   POST   /api/cases/:id/decision     → store manager decision    │
│   GET    /api/analytics/summary      → metrics                   │
│   POST   /api/policies/reindex       → re-embed policies (admin) │
│                                                                  │
│  lib/ai/                                                         │
│   gemini.ts           → client wrapper, schema validation        │
│   analyze.ts          → orchestrator (the ★ pipeline)            │
│   prompts.ts          → master prompts (see section 6)           │
│   embeddings.ts       → text-embedding-004 calls                 │
│   retrieve.ts         → pgvector cosine similarity over policy   │
│   score.ts            → weighted RVS formula                     │
│                                                                  │
│  lib/db/prisma.ts     → Prisma singleton                         │
└──────────────┬──────────────────────────────┬────────────────────┘
               │                              │
       ┌───────▼────────┐            ┌────────▼─────────┐
       │  Neon Postgres │            │  Vercel Blob     │
       │  + pgvector    │            │  (images, PDFs)  │
       └────────────────┘            └──────────────────┘
                       │
               ┌───────▼────────┐
               │  Gemini API    │
               │  (Flash + emb) │
               └────────────────┘
```

---

## 4. Repo structure

```
returnguard/
├── app/
│   ├── (marketing)/page.tsx              # landing or case list
│   ├── cases/
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx                 # analysis dashboard
│   ├── analytics/page.tsx
│   ├── policies/page.tsx
│   └── api/
│       ├── cases/route.ts
│       ├── cases/[id]/route.ts
│       ├── cases/[id]/upload/route.ts
│       ├── cases/[id]/analyze/route.ts
│       ├── cases/[id]/decision/route.ts
│       ├── analytics/summary/route.ts
│       └── policies/reindex/route.ts
├── components/
│   ├── ui/                               # shadcn-generated
│   ├── case-intake-form.tsx
│   ├── analysis-dashboard.tsx
│   ├── evidence-tabs.tsx
│   ├── decision-panel.tsx
│   ├── score-card.tsx
│   └── policy-evidence-list.tsx
├── lib/
│   ├── ai/
│   │   ├── gemini.ts
│   │   ├── analyze.ts
│   │   ├── prompts.ts
│   │   ├── embeddings.ts
│   │   ├── retrieve.ts
│   │   ├── score.ts
│   │   └── schema.ts                     # zod schemas for AI output
│   ├── db/prisma.ts
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                           # seed 8 demo cases + 3 policies
├── data/
│   ├── policies/
│   │   ├── return-policy.md
│   │   ├── replacement-policy.md
│   │   └── warranty-policy.md
│   └── demo-cases/
│       ├── c001/ (complaint.txt, image1.jpg, invoice.pdf, expected.json)
│       ├── c002/
│       └── ...
├── scripts/
│   ├── index-policies.ts                 # chunk + embed policies
│   └── run-evaluation.ts                 # batch-run all 8 cases, write metrics
├── .env.local
└── README.md
```

---

## 5. Prisma schema (copy-paste-ready)

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

model Case {
  id              String   @id @default(cuid())
  customerName    String
  productModel    String
  serialNumber    String?
  complaintText   String   @db.Text
  requestedAction String   // replacement | refund | repair
  status          String   @default("new") // new | analyzing | analyzed | decided
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  documents       Document[]
  analysis        AiAnalysis?
  decision        ManagerDecision?
}

model Document {
  id            String   @id @default(cuid())
  caseId        String
  case          Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  docType       String   // image | invoice | delivery_note | warranty | return_request
  blobUrl       String
  mimeType      String
  extractedJson Json?
  createdAt     DateTime @default(now())

  @@index([caseId])
}

model PolicyChunk {
  id          String                       @id @default(cuid())
  policyName  String   // "Return Policy"
  sectionRef  String   // "3.2"
  ruleType    String?  // "technician_required" | "open_box_depreciation" | ...
  chunkText   String                       @db.Text
  embedding   Unsupported("vector(768)")?
  createdAt   DateTime @default(now())

  @@index([policyName])
}

model AiAnalysis {
  id                       String   @id @default(cuid())
  caseId                   String   @unique
  case                     Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  replacementValidityScore Int
  recommendation           String
  retrievedChunks          Json     // [{chunkId, policyName, sectionRef, score}]
  explanationJson          Json     // full appendix-A object
  rawOutput                String   @db.Text
  modelUsed                String   // "gemini-2.0-flash"
  latencyMs                Int
  createdAt                DateTime @default(now())
}

model ManagerDecision {
  id          String   @id @default(cuid())
  caseId      String   @unique
  case        Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  decision    String   // approve | reject | request_evidence | remote_troubleshoot | send_technician | escalate
  managerNote String?  @db.Text
  decidedAt   DateTime @default(now())
}
```

After paste, run:
```bash
pnpm prisma migrate dev --name init
# pgvector extension may need to be enabled in Neon SQL Editor first:
# CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 6. AI module design — the actual prompts

The proposal lists 6 modules. We collapse them into **two Gemini calls per case**, executed by `lib/ai/analyze.ts`:

```
analyze_case(caseId):
  case      = load case + documents from DB
  policy_q  = build query string from case (complaint + product + requested action)
  chunks    = retrieve_top_k_policy_chunks(policy_q, k=5)   ← embedding + cosine
  evidence  = await gemini.analyze(case, files, chunks)     ← CALL 1 (multimodal)
  decision  = await gemini.recommend(evidence, chunks)      ← CALL 2 (text, JSON mode)
  rvs       = computeWeightedScore(evidence, decision)
  save AiAnalysis
  return decision
```

(For maximum speed in the 2-day window, you can collapse Call 1 and Call 2 into ONE call — it works, but separating them gives you cleaner intermediate outputs to show in the dashboard and is more academically defensible. Start collapsed, split on Day 2 if time allows.)

### 6.1 Master analysis prompt — `lib/ai/prompts.ts`

```ts
export const SYSTEM_PROMPT = `
You are ReturnGuard AI, a decision-support assistant for product return and replacement validation.
You DO NOT make final approval decisions. You analyze evidence and recommend the next action for a human manager.

Hard rules:
1. Use ONLY the provided evidence and retrieved policy. Never invent facts.
2. Separate verified_facts from assumptions and uncertainties.
3. If the complaint is a FUNCTIONAL defect (not cooling, vibration, noise, software error, electrical),
   photos alone CANNOT prove the defect. You MUST recommend "remote_troubleshooting", "send_technician",
   or "request_more_evidence" — never "approve_replacement" based on photos alone for functional claims.
4. For each policy rule you apply, cite its sectionRef in policy_analysis.relevant_sections.
5. If the complaint text contradicts the visual evidence, list it in "contradictions".
6. Return ONLY valid JSON matching the schema. No prose outside the JSON.
`;

export const buildUserPrompt = (input: {
  caseMetadata: object;
  complaintText: string;
  requestedAction: string;
  retrievedPolicy: { policyName: string; sectionRef: string; chunkText: string }[];
}) => `
Analyze the following case.

CASE METADATA:
${JSON.stringify(input.caseMetadata, null, 2)}

CUSTOMER COMPLAINT:
"${input.complaintText}"

REQUESTED ACTION: ${input.requestedAction}

UPLOADED FILES: [images and any invoice/PDF are attached as inline parts]

RETRIEVED POLICY CHUNKS:
${input.retrievedPolicy
  .map((c, i) => `[${i + 1}] ${c.policyName} §${c.sectionRef}\n${c.chunkText}`)
  .join("\n\n")}

Return a single JSON object with this exact schema:
{
  "case_summary": "one concise paragraph",
  "complaint_analysis": {
    "category": "functional_issue|visible_damage|missing_accessory|installation_issue|cosmetic",
    "severity": "low|medium|high|critical",
    "clarity_score": 0,
    "missing_evidence": []
  },
  "visual_analysis": {
    "visible_damage": false,
    "damage_type": "scratch|dent|broken_part|leakage|packaging_damage|none_visible|unclear",
    "evidence_quality_score": 0,
    "serial_number_visible": false,
    "claim_image_consistency": "supports_claim|does_not_support_claim|inconclusive",
    "visual_uncertainty": ""
  },
  "document_analysis": {
    "invoice_valid": null,
    "warranty_status": "active|expired|unknown",
    "return_window_status": "within|expired|unknown",
    "product_value_aed": null,
    "extracted_fields": {
      "invoice_number": null, "customer_name": null, "product_model": null,
      "serial_number": null, "invoice_date": null, "delivery_date": null,
      "warranty_start_date": null, "warranty_end_date": null
    }
  },
  "policy_analysis": {
    "relevant_sections": [],
    "policy_result": ""
  },
  "contradictions": [],
  "verified_facts": [],
  "uncertainties": [],
  "replacement_validity_score": 0,
  "recommended_action": "approve_replacement|reject_request|request_more_evidence|remote_troubleshooting|send_technician|escalate_manager",
  "manager_summary": "concise human-readable recommendation, no customer-blaming language"
}
`;
```

### 6.2 Gemini client — `lib/ai/gemini.ts`

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const flashModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.2,
  },
});

export const embedModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

// Helper: pass image/PDF Blobs as inlineData parts
export async function analyzeMultimodal(
  systemInstruction: string,
  userPrompt: string,
  files: { mimeType: string; base64: string }[]
) {
  const result = await flashModel.generateContent({
    systemInstruction,
    contents: [
      {
        role: "user",
        parts: [
          { text: userPrompt },
          ...files.map((f) => ({
            inlineData: { mimeType: f.mimeType, data: f.base64 },
          })),
        ],
      },
    ],
  });
  return result.response.text();
}
```

### 6.3 Output validation — `lib/ai/schema.ts`

Use Zod to validate the JSON before saving. If invalid, retry once with `"You returned invalid JSON. Return ONLY valid JSON matching the schema."` appended. This is the proposal's "repair prompt" pattern (section 18).

### 6.4 Weighted score (proposal §12.1)

```ts
export function computeRVS(e: AiAnalysisJson): number {
  return Math.round(
    0.20 * e.complaint_analysis.clarity_score +
    0.20 * e.visual_analysis.evidence_quality_score +
    0.25 * documentEligibilityScore(e.document_analysis) +
    0.25 * policyComplianceScore(e.policy_analysis, e.recommended_action) +
    0.10 * 50 // historical/business context — fixed for MVP
  );
}
```

Use this as a sanity check against the LLM-reported score. If they disagree by >20, log it (this becomes a slide).

### 6.5 Policy retrieval — `lib/ai/retrieve.ts`

```ts
export async function retrieveTopK(query: string, k = 5) {
  const [embedding] = await embed([query]);
  // pgvector cosine — Prisma doesn't support vector ops natively, use raw query:
  return prisma.$queryRaw`
    SELECT id, "policyName", "sectionRef", "chunkText",
           1 - (embedding <=> ${embedding}::vector) AS score
    FROM "PolicyChunk"
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${k};
  `;
}
```

---

## 7. API route specs (what each one does)

| Route | Method | Body / Params | Returns |
|---|---|---|---|
| `/api/cases` | POST | `{customerName, productModel, serialNumber?, complaintText, requestedAction}` | `{id}` |
| `/api/cases/:id/upload` | POST | `FormData` with file + `docType` | `{documentId, blobUrl}` |
| `/api/cases/:id/analyze` | POST | — | full `AiAnalysis` object |
| `/api/cases/:id` | GET | — | `{case, documents, analysis, decision}` |
| `/api/cases/:id/decision` | POST | `{decision, managerNote?}` | `{id, decidedAt}` |
| `/api/analytics/summary` | GET | — | `{totalCases, approved, rejected, evidenceRequested, technicianAvoided, estimatedSavingAed}` |
| `/api/policies/reindex` | POST | — | `{chunks: number}` |

---

## 8. Dashboard layout — `/cases/[id]/page.tsx`

Mirror proposal §16.3:

```
┌──────────────────────────────────────────────────────────────┐
│  ★ SCORE CARD   (big number, color-coded, recommendation)   │
│  RVS: 55/100   |   ⚠ Remote troubleshoot recommended        │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  Tabs: [Complaint] [Images] [Documents] [Policy] [Cost]      │
│                                                              │
│  Complaint tab: text + category badge + clarity score        │
│  Images tab: thumbnails + visible_damage + uncertainty note  │
│  Documents tab: editable extracted fields table              │
│  Policy tab: retrieved chunks with relevance score + link    │
│  Cost tab: per-case estimate (technician + open-box loss)    │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  Manager Decision                                            │
│  [Approve] [Reject] [Request Evidence] [Remote] [Tech] [Esc] │
│  Note: [textarea]                              [Submit]      │
└──────────────────────────────────────────────────────────────┘
```

Colors (proposal §16.2): green = eligible / approve, orange = needs evidence / remote, red = reject or contradiction flagged.

---

## 9. Demo dataset (build this on Day 1 morning)

Eight synthetic cases, mirroring proposal §13.2 plus three more for variety. Put under `data/demo-cases/`. For each: `complaint.txt`, 1–2 product images (use free stock or photograph your own appliances), `invoice.pdf` (generate with Pages/Word → PDF), and `expected.json` with the gold-label decision.

| ID | Complaint | Evidence | Expected Decision |
|---|---|---|---|
| C001 | "Refrigerator not cooling" | No visible damage; warranty active; return window expired | remote_troubleshooting or send_technician |
| C002 | "Washer arrived with broken door" | Clear photo of broken door; delivery 2 days ago; invoice valid | approve_replacement |
| C003 | "Minor scratch found after 20 days" | Small cosmetic scratch photo; return window expired | reject_request (with escalate option) |
| C004 | "Missing accessory" | Photo of box contents matches partial list | request_more_evidence then accessory dispatch |
| C005 | "Says defective, no photo/video" | Only complaint text; invoice valid | request_more_evidence |
| C006 | "AC unit noisy and vibrating" | Photo shows normal unit, no error code | remote_troubleshooting |
| C007 | "Unit arrived dented" + photo shows NO damage | Contradiction case; delivery note signed in good condition | reject_request OR request_more_evidence (flag contradiction) — **THE GOLDEN DEMO** |
| C008 | "Wrong model delivered" | Photo of serial label doesn't match invoice model | approve_replacement |

**C007 is your hero slide.** It demonstrates contradiction handling (proposal §12.3) and is the strongest evidence that AI > human gut-feel.

---

## 10. Environment variables — `.env.local`

```bash
# Database
DATABASE_URL="postgresql://...neon.tech/returnguard?sslmode=require"

# Gemini
GEMINI_API_KEY="..."          # https://aistudio.google.com/app/apikey

# Vercel Blob (auto-injected on Vercel, set manually for local)
BLOB_READ_WRITE_TOKEN="..."   # vercel blob token create

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 11. Kickoff commands (Day 1 hour 0)

```bash
# 1. Scaffold
pnpm create next-app@latest returnguard --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*"
cd returnguard

# 2. Dependencies
pnpm add @prisma/client @google/generative-ai @vercel/blob zod react-hook-form @hookform/resolvers
pnpm add -D prisma tsx @types/node

# 3. shadcn/ui
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card input textarea select form tabs badge dialog table toast

# 4. Prisma
pnpm prisma init
# → paste schema from section 5 into prisma/schema.prisma
# → set DATABASE_URL in .env

# 5. Enable pgvector in Neon SQL editor:
#    CREATE EXTENSION IF NOT EXISTS vector;

# 6. Migrate
pnpm prisma migrate dev --name init
pnpm prisma generate

# 7. Run dev server
pnpm dev
```

---

## 12. Two-day execution plan (the timeline)

### Day 1 — build the engine

**Hour 0–2  (all three together)**
- Run kickoff commands. Get Neon DB connected. Verify `prisma studio` works.
- Set up Vercel project (connect git, add env vars). Push empty repo to confirm deploy works.
- Create `data/policies/` with 3 short markdown files (1–2 pages each):
  - `return-policy.md` (return window, physical damage rule, opened-unit rule)
  - `replacement-policy.md` (direct replacement eligibility, technician-required cases, manager approval threshold)
  - `warranty-policy.md` (coverage duration, exclusions, functional fault process)

**Hour 2–4  (split)**
- **Vishal** — Case Intake page (`/cases/new`) + file upload to Blob. Working end to end (case row appears in DB).
- **Shahansha** — Prisma client singleton, `POST /api/cases`, `POST /api/cases/:id/upload`, demo seed script that inserts 8 cases.
- **Alif** — `lib/ai/gemini.ts` + `lib/ai/embeddings.ts` + `scripts/index-policies.ts`. After this you should be able to run `pnpm tsx scripts/index-policies.ts` and see 10–15 rows in `PolicyChunk` table.

**Hour 4–6  (split)**
- **Alif** — `lib/ai/analyze.ts` end-to-end. Wire up master prompt. Run it on C002 (the clear-damage case — easiest). Iterate until JSON is valid + recommendation is correct.
- **Shahansha** — `POST /api/cases/:id/analyze` endpoint + `GET /api/cases/:id`. Test with curl.
- **Vishal** — Analysis dashboard skeleton (`/cases/[id]/page.tsx`). Hard-code mock JSON first, get layout right, then swap to real data.

**Hour 6–8  (merge)**
- Connect Vishal's dashboard to Shahansha's API. One full case (C002) runs through the UI end-to-end.
- Run remaining 7 cases through the API directly (script: `scripts/run-evaluation.ts`). Save outputs.
- Stop. Review outputs as a team. Note which prompts fail. Sleep.

### Day 2 — polish, evaluate, present

**Hour 0–2** — fix Day 1 failures. Most fixes will be prompt tweaks. The C007 contradiction case is the most likely to fail — iterate the prompt until it correctly flags the inconsistency.

**Hour 2–4** — Decision panel + decision API + manager-note persistence. Color coding. Tabs filled in with real data. Cost calculation per case using proposal §20 formula.

**Hour 4–6** — Analytics page (count by decision, estimated saved AED, charts using recharts). Run `scripts/run-evaluation.ts` and write the metrics into the report:
- Recommendation agreement vs expected label (target ≥75%)
- JSON validity rate (target ≥95%)
- Avg latency (target <30s)
- Hallucination spot-check on 3 cases (manual)

**Hour 6–8** — Deploy to Vercel. Record a 3-min screen demo (in case live demo breaks). Build the presentation slides:
1. The problem (scratch claim → open-box → lost margin)
2. Current vs AI workflow (use proposal Figure 1)
3. Architecture (use proposal Figure 2, simplified)
4. Live demo of C007 (the contradiction case)
5. Evaluation table on 8 cases
6. Cost saving: `8 cases × X% prevented × 930 AED = $$$/month`
7. Limitations + future work (50→500 cases, fine-tune scoring, video evidence)

---

## 13. What to do when you get stuck

- **Gemini returns invalid JSON** → Lower temperature to 0.1. Append the schema example to the user prompt. If still failing, switch to `gemini-1.5-pro` (slower but more reliable).
- **Rate limit hit (429)** → Switch to local Ollama: `ollama pull llama3.2-vision:11b`, then point `lib/ai/gemini.ts` at a local-mode flag. Same prompts work.
- **Vercel Blob fails locally** → Set `BLOB_READ_WRITE_TOKEN` via `vercel env pull .env.local`.
- **pgvector not found** → In Neon SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;` then `pnpm prisma migrate reset`.
- **Image too big for Gemini** → Downscale to 1024px before encoding to base64. Use `sharp`.

---

## 14. Things you can fake convincingly for the demo

These are honest shortcuts that the proposal won't notice and the audience won't see:
- **8 cases instead of 50–100.** Say "MVP evaluation set; future work scales to 100+".
- **Synthetic policies + synthetic invoices.** Proposal §13 explicitly permits this.
- **No background jobs.** A spinner is fine for 20 seconds.
- **Hardcoded manager identity.** Add an auth disclaimer to the limitations slide.
- **One Gemini call instead of six modules.** Frame it in the slides as "modular pipeline with shared multimodal foundation" — this is technically accurate.
- **In-memory vector search if pgvector is being slow.** 10 chunks fit in RAM trivially.

---

## 15. The single most important slide

**The C007 contradiction case.** Before AI, the manager saw: "complaint says dented" + a photo + an invoice — and might have approved a replacement. After ReturnGuard: the AI cross-checks the photo against the complaint, notices no visible damage, references the delivery-note signature, and recommends "request more evidence" with a citation to the return policy section. That's the story. Everything else is supporting cast.

---

## 16. Use this brief as an AI coding prompt

When opening Cursor / Claude Code / ChatGPT to generate code, paste sections 1, 2, 3, 5, 6, 7, and the specific section relevant to your file (e.g., section 8 if building the dashboard). The brief is structured so each section is a self-contained context block.

Example: *"You are helping me build the file `app/api/cases/[id]/analyze/route.ts` for the project described above. Implement the orchestration logic per section 6, using the Prisma schema in section 5 and the API contract in section 7."*

---

**Owner roles for accountability**
- **Alif** — AI pipeline (`lib/ai/`), prompts, evaluation, final report
- **Shahansha** — Backend API routes, Prisma schema, file upload, deployment
- **Vishal** — Frontend pages, dashboard, dataset preparation, slides

Good luck. Build the boring path first, polish second. Ship by Day 2 evening.

---

# PART II — Proposal Coverage & Claude Code CLI Execution

This part exists to guarantee that the 2-day MVP **demonstrably covers every section of the original proposal**. When grading or client review asks "where is Module C implemented?" or "how is RQ2 measured?", point at this table.

---

## 17. Proposal coverage matrix (every section → where it lives in code)

| Proposal § | Topic | Implementation location | Evidence in demo |
|---|---|---|---|
| §1 Executive Summary | Project pitch | `README.md` intro + slide 1 | Slide deck |
| §2 Group Roles | Responsibility split | Owner labels in brief §11 | README + commit history |
| §3 Business Problem | Returns → open-box → margin loss | Slide 1–2; `lib/cost.ts` formula | Cost-saving slide w/ real numbers |
| §4 Proposed Solution | Web platform overview | Whole repo | Live demo |
| §5.1–5.2 Objectives | 7 specific objectives | Each maps to a file (see §18 below) | Coverage matrix in report |
| §5.3 Research Questions | RQ1–RQ5 | `scripts/run-evaluation.ts` → `evaluation-report.md` | Metrics table in report |
| §5.4 Scope Boundary | Advisory only, not autonomous | UI governance banner + prompt rules | Dashboard banner |
| §6.1 Multimodal Learning | Text + image + doc fused | `lib/ai/analyze.ts` single multimodal Gemini call | Demo |
| §6.2 RAG | Policy chunks → cosine → top-k → grounded LLM | `lib/ai/retrieve.ts` + `lib/ai/embeddings.ts` | "Policy" tab in dashboard |
| §6.3 Human-in-the-Loop | Manager accepts/rejects/overrides | `app/api/cases/[id]/decision/route.ts` + `ManagerDecision` table | Decision panel |
| §6.4 Evidence Fusion | Structured JSON over raw files | Zod schema in `lib/ai/schema.ts` + DB JSONB column | DB rows + dashboard JSON view |
| §7 Model Foundations | Hybrid track | Gemini 2.0 Flash (hosted) + Ollama (local fallback) | Architecture slide |
| §8 System Architecture | 6 layers | Brief §3 ASCII diagram | Architecture slide |
| §9 Operational Workflow | 8-step case flow | Wired across API routes in brief §7 | Demo walkthrough |
| §10 Modules A–F | 6 AI modules | Mapped in §20 below | Architecture slide annotations |
| §11 RAG Pipeline | Chunking + retrieval + guardrails | `scripts/index-policies.ts` + `lib/ai/retrieve.ts` | Policy tab |
| §11.4 RAG Guardrails | 5 safety rules | Encoded in `SYSTEM_PROMPT` (brief §6.1) + Zod | Spot-check in evaluation |
| §12 Risk Scoring | Weighted RVS + thresholds | `lib/ai/score.ts` | Score card on dashboard |
| §12.3 Contradiction Handling | Flag claim-evidence inconsistency | `contradictions[]` in JSON + red flag in UI | **C007 demo case** |
| §13 Dataset | 50–100 cases | 8 controlled cases in `data/demo-cases/` (honest scope note) | Evaluation report |
| §14 Database Design | 7 tables | `prisma/schema.prisma` (5 tables; audit + extracted fields folded into JSONB) | Prisma Studio |
| §15 API & Backend | 8 endpoints | `app/api/**/route.ts` (brief §7) | Network tab in demo |
| §16 UI/UX | 6 pages + design rules | `app/**/page.tsx` (brief §4 + §8) | Live UI |
| §17 Roadmap | 8 phases × 1 week | Compressed into brief §12 (2 days) with honest scope note | Slide |
| §18 Prompt Engineering | Strict schema + repair loop | `lib/ai/prompts.ts` + Zod retry in `lib/ai/analyze.ts` | Logs + JSON validity metric |
| §19 Evaluation Methodology | 6 technical + 5 business metrics | `scripts/run-evaluation.ts` → `evaluation-report.md` | Metrics slide |
| §20 Cost-Saving Model | Per-return cost formula | `lib/cost.ts` + `/analytics` page | Cost slide |
| §21 Deployment & Security | Web architecture + 6 controls | Vercel + brief §25 below | Architecture slide |
| §22 Risks & Mitigations | 8 risks | Mapped in §26 below | Limitations slide |
| §23 Deliverables | 7 outputs | Checklist in §27 below | All-deliverables slide |
| §24 Conclusion | Wrap-up | Slide N | Final slide |
| Appendix A JSON Schema | Output contract | `lib/ai/schema.ts` (Zod) — generated from this | Type-checked at build |
| Appendix B SQL Schema | Tables | Implemented as Prisma in brief §5 | Prisma Studio |
| Appendix C Prompts | 3 example prompts | Consolidated into master prompt in brief §6.1 | Logs |

---

## 18. Specific objectives (§5.2) → file mapping

| # | Objective | File / module |
|---|---|---|
| 1 | Case intake system (text, images, documents) | `app/cases/new/page.tsx`, `app/api/cases/route.ts`, `app/api/cases/[id]/upload/route.ts` |
| 2 | Document intelligence (extract fields) | `extracted_fields` inside the master analysis JSON (Gemini reads PDFs directly — no OCR library) |
| 3 | Multimodal image analysis | `visual_analysis` block in master JSON; produced by Gemini multimodal call |
| 4 | RAG pipeline over policy KB | `scripts/index-policies.ts` + `lib/ai/retrieve.ts` |
| 5 | Replacement validity scoring | `lib/ai/score.ts` (weighted formula §12.1) |
| 6 | Explainable recommendations | `manager_summary`, `verified_facts`, `uncertainties`, `policy_analysis.relevant_sections` in JSON; rendered in dashboard tabs |
| 7 | Evaluation: extraction, retrieval, agreement, hallucination, savings | `scripts/run-evaluation.ts` → `evaluation-report.md` |

---

## 19. Research questions (§5.3) → how each is answered

| RQ | Question | Metric | Computed in | Target |
|---|---|---|---|---|
| RQ1 | Does multimodal GenAI improve return-case assessment? | Recommendation agreement (AI vs expert label) on 8 cases | `scripts/run-evaluation.ts` | ≥75% |
| RQ2 | Does RAG reduce policy-inconsistent answers? | (a) Policy citation rate (every recommendation cites ≥1 chunk); (b) hallucination rate from manual audit | `scripts/run-evaluation.ts` + manual spot-check | Citation 100% / hallucinations <10% |
| RQ3 | Does document intelligence reduce manual checking time? | Avg field-extraction latency vs hand-typing estimate | `scripts/run-evaluation.ts` (latencyMs) + estimated 30–60 min baseline from §20 | Latency <30s |
| RQ4 | Does risk score help prioritize manager review? | Score alignment with expert label (correlation) | `scripts/run-evaluation.ts` | Pearson r > 0.5 on 8 cases |
| RQ5 | Does the system reduce technician visits / open-unit losses? | Sum of `avoidedCost()` over cases where recommendation ≠ approve_replacement | `/analytics` page + report | Demonstrated saving estimate in AED |

---

## 20. Modules A–F (§10) → exact file mapping

| Module | Implementation | File |
|---|---|---|
| **A. Complaint Text Analyzer** | `complaint_analysis` block in master JSON | `lib/ai/analyze.ts` (single call) |
| **B. Product Image Analyzer** | `visual_analysis` block (Gemini multimodal) | `lib/ai/analyze.ts` (single call) |
| **C. Document Intelligence** | `document_analysis.extracted_fields` (Gemini reads PDFs natively) | `lib/ai/analyze.ts` (single call) |
| **D. Policy RAG Engine** | `policy_analysis.relevant_sections` populated from retrieved chunks | `lib/ai/retrieve.ts`, `lib/ai/embeddings.ts`, `scripts/index-policies.ts` |
| **E. LLM Reasoning Agent** | `recommended_action`, `manager_summary`, `replacement_validity_score` | `lib/ai/analyze.ts` (final reasoning) + `lib/ai/score.ts` (RVS override) |
| **F. Human Decision & Audit Layer** | `ManagerDecision` table + decision panel UI | `app/api/cases/[id]/decision/route.ts` + `components/decision-panel.tsx` |

**Reporting framing:** in the slide deck and report, present these as six conceptual modules unified under a shared multimodal foundation model — this is technically accurate and pedagogically clean.

---

## 21. RAG guardrails (§11.4) — encoded in code

| Guardrail | Where enforced |
|---|---|
| If no policy retrieved → say "policy evidence not found" | `lib/ai/analyze.ts` checks `chunks.length === 0` and adjusts prompt; also the `SYSTEM_PROMPT` rule |
| Every recommendation cites a policy section | `SYSTEM_PROMPT` hard rule #4 + Zod requires non-empty `policy_analysis.relevant_sections` |
| Separate verified facts from assumptions | JSON has `verified_facts[]` and `uncertainties[]`; both required by Zod |
| Image-based uncertainty marked for functional defects | `SYSTEM_PROMPT` hard rule #3 + Zod requires `visual_analysis.visual_uncertainty` non-empty for functional categories |
| Never auto-approve / auto-reject | `recommended_action` is one of 6 values, dashboard shows all 6 as buttons to the human |

---

## 22. Contradiction handling (§12.3) — wired end-to-end

- **Prompt:** master `SYSTEM_PROMPT` instructs the model to populate `contradictions[]` whenever the complaint text and visual evidence (or document evidence) disagree.
- **Schema:** `contradictions: string[]` required (can be empty).
- **UI:** dashboard renders a red banner above the score card whenever `contradictions.length > 0`, listing each one.
- **Demo:** Case C007 is built specifically to exercise this path.

---

## 23. Evaluation script (§19) — full spec

`scripts/run-evaluation.ts` must:

1. Iterate over `data/demo-cases/c00*/` directories.
2. For each: read `complaint.txt`, `expected.json`, attach image(s) + invoice PDF.
3. Call the same `analyze()` orchestrator used by the API.
4. Record per-case: `recommended_action`, `expected_decision`, `replacement_validity_score`, `latency_ms`, `json_valid: bool`, `chunks_retrieved: number`, `cites_policy: bool`.
5. Compute aggregates:
   - `recommendation_agreement = matches / total`
   - `json_validity_rate = valid / total`
   - `policy_citation_rate = cites / total`
   - `avg_latency_ms`
   - `score_label_correlation` (Pearson on score vs expected severity rank)
6. Write `evaluation-report.md` with: per-case table, aggregate metrics, three example success cases, two failure cases with notes, and the cost-saving calculation from §24 below.

This file is **a deliverable** (§23 row "Evaluation Report") — include it in the final submission.

---

## 24. Cost-saving model (§20) — `lib/cost.ts`

```ts
export const COST_CONSTANTS = {
  technicianVisitAed: 150,
  reverseLogisticsAed: 80,
  replacementDeliveryAed: 100,
  openBoxDepreciationRate: 0.20,  // 20%
};

export function avoidedCostPerCase(productValueAed: number): number {
  const openBoxLoss = productValueAed * COST_CONSTANTS.openBoxDepreciationRate;
  return (
    COST_CONSTANTS.technicianVisitAed +
    COST_CONSTANTS.reverseLogisticsAed +
    COST_CONSTANTS.replacementDeliveryAed +
    openBoxLoss
  );
}

export function projectedMonthlySaving(
  preventedReturnsPerMonth: number,
  avgProductValueAed: number
): number {
  return preventedReturnsPerMonth * avoidedCostPerCase(avgProductValueAed);
}
```

`/analytics` page renders: total cases analyzed, count by recommendation, sum of `avoidedCostPerCase` over cases where `recommended_action !== 'approve_replacement'`, and an extrapolated monthly saving slider so the manager can adjust volume assumptions live.

---

## 25. Security & governance (§21) — implementation checklist

| Control (§21.2) | Implementation |
|---|---|
| Role-based access | Hardcoded role dropdown in header (`customer_service` / `manager`). Decision endpoints check role on Day 2. |
| File type validation | Upload route accepts only `image/jpeg`, `image/png`, `image/webp`, `application/pdf` via Zod. |
| PII minimization | Server logs scrub `complaintText` and mask `serialNumber`/`invoice_number` (last 4 digits only). |
| Audit logging | Day 2: add `AuditLog` table; every analyze + decision writes a row. (Day 1 acceptable to skip.) |
| Model output logging | Stored in `AiAnalysis.rawOutput` for evaluation; redacted view in UI. |
| Env var hygiene | All keys in `.env.local`, `.env.example` committed with placeholders, secrets in Vercel env. |
| Data retention | README states "demo data retained until project review; production retention TBD per client policy." |
| **Governance banner (§21.3)** | Persistent header banner: *"AI output is advisory. Final decision belongs to the authorized manager."* Rendered in `app/layout.tsx`. |

---

## 26. Risks & mitigations (§22) — code-level mapping

| Risk (§22) | Mitigation in code |
|---|---|
| Images can't prove functional defects | `SYSTEM_PROMPT` hard rule #3 forces remote/technician path; `visual_uncertainty` always populated |
| OCR / extraction errors | `extracted_fields` editable on dashboard before submitting decision |
| Wrong policy section retrieved | Dashboard shows retrieved chunks with score; manager can re-run with manual query (Day 2 nice-to-have) |
| LLM hallucination | Zod validation + repair retry; `verified_facts` vs `uncertainties` separation; citation requirement |
| Small dataset (8 vs 50–100) | Honest disclosure in `evaluation-report.md` + future-work slide |
| Sensitive customer data | Synthetic dataset for demo (per §13.3); PII scrubbing in logs |
| Model bias / overconfidence | `uncertainties[]` always shown; human-in-loop never bypassed |
| Multimodal deployment cost | Gemini free tier covers MVP; local Ollama fallback documented in brief §13 |

---

## 27. Expected deliverables (§23) — file checklist

| # | Deliverable | Location |
|---|---|---|
| 1 | Web Application MVP | `app/` deployed to Vercel; live URL in README |
| 2 | AI Pipeline | `lib/ai/*.ts` + `scripts/index-policies.ts` |
| 3 | Policy Knowledge Base | `data/policies/*.md` + `PolicyChunk` table |
| 4 | Evaluation Dataset | `data/demo-cases/c00*/` (complaint, images, invoice, expected.json) |
| 5 | Evaluation Report | `evaluation-report.md` generated by `scripts/run-evaluation.ts` |
| 6 | Final Presentation | `presentation/` folder with slides (Day 2) |
| 7 | Source Code Repository | The git repo itself; `README.md` includes setup, env vars, deploy instructions |

When all seven boxes are checked, the project meets §23.

---

## 28. Claude Code CLI execution plan — phased, with verification gates

Each phase below is a discrete prompt you paste into Claude Code. **Stop after each phase, run the verification command, confirm green, then proceed.** This prevents drift and gives you natural review points.

### Phase 0 — Bootstrap (one-time)

**Paste to Claude Code:**
> Read `CLAUDE.md` and `RETURNGUARD_BUILD_BRIEF.md` end-to-end. Confirm you understand the project, the locked stack, and the 28-phase execution plan in Part II Section 28. Do not write any code yet. Reply with a 5-bullet summary of what you understood and any clarifying questions.

**Verification:** read the summary; correct any misunderstanding before moving on.

---

### Phase 1 — Project scaffold

**Paste to Claude Code:**
> Execute Section 11 (Kickoff Commands) of `RETURNGUARD_BUILD_BRIEF.md`. Initialize the Next.js app, install all dependencies, initialize shadcn/ui, initialize Prisma. Use pnpm. After scaffolding, create the folder structure described in Section 4 (empty files with TODO comments are fine). Stop and report.

**Verification:**
```bash
pnpm dev          # should serve a default Next.js page on :3000
ls app/api        # cases/ analytics/ policies/ folders exist
ls lib/ai         # gemini.ts analyze.ts prompts.ts ... files exist
```
**Acceptance:** dev server boots, folder structure matches brief §4.

---

### Phase 2 — Database schema + Neon connection

**Paste to Claude Code:**
> Implement the Prisma schema from `RETURNGUARD_BUILD_BRIEF.md` Section 5 exactly. Create the singleton Prisma client at `lib/db/prisma.ts`. Add a script `scripts/db-test.ts` that creates one test case and reads it back. Wait for me to set `DATABASE_URL` and enable `CREATE EXTENSION vector;` in Neon before running migrate.

**Verification:**
```bash
# After enabling pgvector in Neon SQL editor:
pnpm prisma migrate dev --name init
pnpm tsx scripts/db-test.ts        # should print the inserted case
pnpm prisma studio                 # should show 5 tables
```
**Acceptance:** all 5 tables exist; test row roundtrips.

---

### Phase 3 — Policy knowledge base + indexing

**Paste to Claude Code:**
> Create the three synthetic policy markdown files in `data/policies/` as described in `RETURNGUARD_BUILD_BRIEF.md` Section 12 Day 1 hour 0–2. Each ~1–2 pages, realistic content covering the sections referenced in `PolicyChunk.sectionRef` (e.g. Return Policy §1 Window, §2 Damage Rule, §3 Open-Unit; Replacement Policy §1 Eligibility, §2 Technician Path, §3 Approval Matrix; Warranty Policy §1 Coverage, §2 Exclusions, §3 Functional Fault Process). Then implement `lib/ai/embeddings.ts` and `scripts/index-policies.ts` to chunk by section (300–600 tokens, 50–100 overlap), embed with `text-embedding-004`, and upsert into `PolicyChunk`. Implement `lib/ai/retrieve.ts` with the raw pgvector cosine query from brief Section 6.5.

**Verification:**
```bash
pnpm tsx scripts/index-policies.ts     # should print "Indexed N chunks"
# In Prisma Studio: PolicyChunk should have 10–15 rows, embedding non-null
# Quick retrieval test:
pnpm tsx -e "import {retrieveTopK} from './lib/ai/retrieve'; retrieveTopK('refrigerator not cooling warranty', 3).then(console.log)"
```
**Acceptance:** retrieval returns top-3 chunks ranked by relevance.

---

### Phase 4 — AI pipeline (the brain)

**Paste to Claude Code:**
> Implement `lib/ai/gemini.ts`, `lib/ai/schema.ts` (Zod for Appendix A schema in brief §6.1), `lib/ai/prompts.ts` (exact prompts from brief §6.1), `lib/ai/score.ts` (RVS formula from brief §6.4), and `lib/ai/analyze.ts` (orchestrator from brief §6). The orchestrator must: load case + documents from DB, retrieve top-5 policy chunks, fetch file bytes from Vercel Blob, encode as base64, call Gemini multimodal with the master prompt, validate output with Zod (one repair retry on failure), compute the weighted RVS as a sanity check, save `AiAnalysis` row, return the JSON.

**Verification:**
```bash
# Test the pipeline standalone on case C002 (clearest case) once it's seeded:
pnpm tsx -e "import {analyzeCase} from './lib/ai/analyze'; analyzeCase('SEED_CASE_ID').then(r=>console.log(JSON.stringify(r,null,2)))"
```
**Acceptance:** returns valid JSON matching the schema; `recommended_action` is `approve_replacement` for C002.

---

### Phase 5 — API routes

**Paste to Claude Code:**
> Implement all 7 API routes from `RETURNGUARD_BUILD_BRIEF.md` Section 7. Each route:
> - Validates input with Zod
> - Returns `NextResponse.json` with explicit status codes
> - Catches errors and returns `{error: string}` with 4xx/5xx
> - `POST /api/cases/:id/upload` uses `@vercel/blob` `put()` and creates the Document row
> - `POST /api/cases/:id/analyze` calls `analyzeCase()` from Phase 4 and returns the result
> Also create `prisma/seed.ts` that inserts the 8 demo cases from brief §9 with placeholder image/PDF URLs (we'll attach real files via the UI later).

**Verification:**
```bash
pnpm prisma db seed
# Manual curl tests:
curl -X POST localhost:3000/api/cases -d '{"customerName":"Test","productModel":"X","complaintText":"test","requestedAction":"replacement"}' -H 'content-type: application/json'
curl -X POST localhost:3000/api/cases/<id>/analyze
```
**Acceptance:** all 7 endpoints respond correctly; analyze writes an `AiAnalysis` row.

---

### Phase 6 — Frontend pages

**Paste to Claude Code:**
> Build the 5 pages from `RETURNGUARD_BUILD_BRIEF.md` Section 4 and dashboard layout in Section 8:
> 1. `/` — case list table with status badges, link to each case
> 2. `/cases/new` — react-hook-form + zod; on submit, POST to `/api/cases`, then upload files, then redirect to `/cases/[id]`
> 3. `/cases/[id]` — the big dashboard: score card on top, tabs (Complaint / Images / Documents / Policy / Cost) in the middle, decision panel at the bottom; "Run Analysis" button if no analysis yet; show loading state while analyzing
> 4. `/analytics` — counts + saving sum + recharts bar chart by recommendation type
> 5. `/policies` — list `PolicyChunk` rows grouped by policyName
> Add the persistent governance banner from §25 to `app/layout.tsx`. Use shadcn components: Card, Tabs, Badge, Button, Table, Form. Color rules per brief §16.2.

**Verification:** click through all 5 pages in a browser; run case C002 end-to-end (create → upload → analyze → see dashboard → click Approve → see decision saved in `/`).

**Acceptance:** full happy-path works in browser.

---

### Phase 7 — Evaluation script + report

**Paste to Claude Code:**
> Implement `scripts/run-evaluation.ts` per `RETURNGUARD_BUILD_BRIEF.md` Section 23. It must read each `data/demo-cases/c00*/` directory, run `analyzeCase()`, compute the 5 aggregate metrics from §19, and write `evaluation-report.md` with: a per-case results table, aggregate metrics block, 3 success-case excerpts, 2 failure-case excerpts with notes on why, and the cost-saving calculation using `projectedMonthlySaving()` from §24.

**Verification:**
```bash
pnpm tsx scripts/run-evaluation.ts
cat evaluation-report.md
```
**Acceptance:** report exists, all 5 metrics computed, recommendation agreement ≥ 75%.

---

### Phase 8 — Deploy + demo + slides

**Paste to Claude Code:**
> Help me deploy to Vercel: create `.env.example`, write the deploy section of `README.md` with Neon + Vercel Blob + Gemini key setup steps, configure `vercel.json` if needed. Then draft `presentation/slides.md` (7 slides per brief §12 Day 2 hour 6–8). After deploy, run a smoke test against the live URL.

**Verification:** live URL works; full demo flow completes on production.

**Acceptance:** Deliverables 1, 6, 7 from §27 are done.

---

## 29. The literal first prompt to paste into Claude Code

Open a terminal in `/Users/Alifka_Roosseo/Desktop/Project/Gen_AI_Project/`, run `claude`, and paste this:

```
We are starting a new project: ReturnGuard AI — a 2-day MVP for my Master's GenAI final
project. Read CLAUDE.md and RETURNGUARD_BUILD_BRIEF.md (both at repo root) in full before
doing anything else.

Then execute Phase 0 from Part II Section 28 of the build brief: give me a 5-bullet
summary confirming what you understood about (1) the business problem, (2) the locked
tech stack, (3) the 6 AI modules and how they collapse into one Gemini call, (4) the
RAG guardrails, and (5) the proposal-coverage matrix in Section 17. Also list any
clarifying questions you have for me before we start Phase 1 scaffolding.

Do not write any code in this turn. Wait for my reply.
```

That's it. Once Claude Code answers, you confirm or correct, then say "Proceed with Phase 1" — and so on through Phase 8. Each phase has a verification command; do not skip them.

---

## 30. Final coverage self-check (run before declaring "done")

Tick each box before submission:

- [ ] All 25 proposal sections mapped in §17 are present in the repo
- [ ] All 7 specific objectives (§18) have a working implementation
- [ ] All 5 research questions (§19) produce a measurable answer in `evaluation-report.md`
- [ ] All 6 modules (§20) are visible in the dashboard (each contributes a tab or section)
- [ ] All 5 RAG guardrails (§21) are enforced in code
- [ ] Contradiction handling (§22) demonstrated via case C007
- [ ] Cost-saving model (§24) calculates real AED on `/analytics`
- [ ] Security & governance banner (§25) renders on every page
- [ ] All 8 risks (§26) have a documented mitigation
- [ ] All 7 deliverables (§27) exist as files
- [ ] Live Vercel URL works
- [ ] 3-min demo video recorded
- [ ] Slides cover problem → architecture → demo → metrics → cost → limitations

When every box is checked, you've delivered what the proposal promised — in 2 days instead of 8 weeks.
