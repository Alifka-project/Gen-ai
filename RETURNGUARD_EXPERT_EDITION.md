# ReturnGuard AI — Expert Edition Build Brief

**Status:** Authoritative. Supersedes `RETURNGUARD_BUILD_BRIEF.md` (v1, retained for history).
**Audience:** PhD students, AI engineers, the academic reviewer, the client engineering team.
**Goal:** Produce a public, reproducible, research-grade Multimodal RAG + Human-in-the-Loop system that satisfies the original proposal and stands up to academic scrutiny.

---

## How to use this document

Three audiences, three entry points:

- **Reviewer / professor:** start at Part I (the design decisions and rationale), then Part VII (Evaluation Methodology) and Part VIII (Research Deliverables).
- **Engineer building it:** start at Part II (Architecture), then Part III (Repo Layout), then jump to Part X (Claude Code CLI Execution Plan) and execute phase by phase.
- **Student trying to learn from it:** read Part I, then open `/notebooks/01_dataset_card.ipynb` and read the notebooks in order.

---

# PART I — Why this revision exists, and what changed

## §1.1 The honest critique of the v1 MVP

The first build (preserved in `RETURNGUARD_BUILD_BRIEF.md`) optimized for *ship in 48 hours*. That bar is incompatible with *PhD-grade research artifact*. The current repo has six concrete weaknesses that a research reviewer will mark down:

1. **Closed commercial API (Gemini)** for all reasoning. Not reproducible without paying Google. Not academically defensible.
2. **Six modules collapsed into one Gemini call** — no architectural decomposition means no ablation studies are possible. The system *cannot* answer "how much does RAG contribute?" because there is no version without RAG.
3. **Naive RAG** — dense cosine retrieval on 9 chunks. No BM25, no hybrid fusion, no reranker, no query expansion, no chunk-relevance verification. In 2026 this is not what "RAG" means in research.
4. **Single-grader labels, no inter-annotator agreement.** Proposal §19.4 explicitly required this.
5. **The headline accuracy is gamed.** Eval report shows "100% recommendation agreement" but exact-match accuracy is only **4/8 = 50%**; the rest are counted as "acceptable alternatives." The contradiction case C007 silently fails to detect a contradiction. The LLM self-score is always 0 while the recomputed formula scores 29–51 — a finding that's just not commented on.
6. **No statistical rigor.** No bootstrap CIs, no calibration analysis, no error taxonomy, no per-stage latency breakdown, no Pearson p-values, no confidence intervals on the reported correlation.

## §1.2 What this edition fixes

| Weakness | Fix |
|---|---|
| Closed APIs | Open-weight models (Qwen2.5-VL, bge family, PaddleOCR) on **Modal** serverless GPU. Reproducible, no commercial vendor lock-in, free for academic-scale usage. |
| Collapsed modules | Six modules now genuinely separate (`/inference/modules/`). Each is independently swappable. Ablations become a one-config-flag change. |
| Naive RAG | Hybrid retrieval (BM25 + dense, RRF fusion), bge-reranker-v2-m3 cross-encoder, LLM query expansion, LLM-as-a-judge chunk relevance filter, self-RAG-style verification. |
| Single grader | Three-annotator protocol on every case. Cohen's κ reported. Disagreements adjudicated and documented. |
| Gamed accuracy | Both strict and relaxed accuracy reported with 95% bootstrap CIs. C007 actually fixed and verified. Score reliability analysed and discussed. |
| No statistics | Bootstrap CIs everywhere. Calibration via ECE + reliability diagram. Error taxonomy with category counts. Per-stage latency, tokens, GPU memory. |

## §1.3 The constraints that stayed

- **Vercel deployment for the web tier** is non-negotiable.
- **Prisma + Postgres (Neon)** stays for the relational store + pgvector.
- **No commercial closed-model APIs** (OpenAI, Anthropic, Gemini).
- **Free / academic-tier cost ceiling** (target: $0/month for typical demo usage).

## §1.4 The constraint that flexed

The original "single-repo Next.js on Vercel" cannot host open-weight inference. The repo is now a **monorepo** with two deployable artifacts:
- `/web/` (current Next.js app, becomes the demo skin)
- `/inference/` (new Python + Modal app, runs the actual AI)

Plus research-grade folders: `/notebooks/`, `/eval/`, `/data/`, `/results/`, `/docs/`, plus paper-style top-level docs.

---

# PART II — Locked architecture

## §2.1 System diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          User browser                                │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Vercel — Next.js 14 App Router                                      │
│                                                                      │
│   Pages       /, /cases/new, /cases/[id], /analytics, /policies      │
│   API routes  /api/cases, /api/cases/:id, /api/cases/:id/upload,     │
│               /api/cases/:id/analyze, /api/cases/:id/decision,       │
│               /api/analytics/summary, /api/policies/reindex          │
│   lib/db      Prisma → Neon Postgres + pgvector                      │
│   lib/blob    Vercel Blob (image, PDF storage)                       │
│   lib/jobs    Inngest functions (async, durable)                     │
│   lib/inference-client.ts  ── HTTPS + bearer token ──┐               │
└──────────────────────────────────────────────────────│───────────────┘
                                                       │
                                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Modal — Python inference tier (serverless GPU)                      │
│                                                                      │
│   /inference/app.py            Modal app entrypoint                  │
│   /inference/pipeline.py       Orchestrator                          │
│   /inference/modules/                                                │
│     ├─ complaint.py            Text feature extraction (LLM)         │
│     ├─ vision.py               Qwen2.5-VL image reasoning            │
│     ├─ ocr.py                  PaddleOCR + field extraction          │
│     ├─ rag.py                  Hybrid retrieve + RRF + rerank        │
│     ├─ reasoner.py             Qwen2.5-VL final reasoning + JSON     │
│     └─ critic.py               Self-critique loop                    │
│   /inference/prompts/vN/       Versioned prompt templates            │
│                                                                      │
│   Models loaded from persistent Modal Volume (no re-download)        │
│   Each module a @modal.function — independently invocable for evals  │
│   Pipeline = one @modal.function that composes them                  │
└──────────────────────────────────────────────────────────────────────┘
                                       ▲
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Neon Postgres + pgvector  (shared between web and inference)        │
│  Tables: Case, Document, PolicyChunk, AiAnalysis, ManagerDecision,   │
│          AuditLog, ExperimentRun, Annotation, StageLog,              │
│          RetrievedChunk (analytics)                                  │
└──────────────────────────────────────────────────────────────────────┘
```

## §2.2 The end-to-end request flow

```
1.  Browser POSTs case + uploads files to Vercel
2.  Vercel writes Case + Document rows to Neon, files to Blob
3.  Browser clicks "Run analysis" → POST /api/cases/:id/analyze
4.  Vercel returns 202 { jobId } immediately
5.  Vercel emits Inngest event "case.analyze.requested"
6.  Inngest worker picks up event:
       a. Loads Case + Document URLs from Neon
       b. POSTs to Modal /pipeline endpoint with auth token
7.  Modal pipeline executes:
       a. complaint.run()    →  complaint_features.json
       b. ocr.run(invoice)   →  extracted_fields.json
       c. vision.run(images) →  visual_features.json
       d. rag.run(case)      →  retrieved_chunks (top-5 after rerank)
       e. reasoner.run(...)  →  appendix_a.json (grammar-constrained)
       f. critic.run(...)    →  critique.json
       g. (if critic flags issues) reasoner re-runs with feedback
8.  Modal POSTs results back to Vercel /api/cases/:id/analysis/complete
9.  Vercel writes AiAnalysis + StageLog + RetrievedChunk rows
10. Browser polls GET /api/cases/:id, sees status="analyzed", renders dashboard
11. Manager clicks decision → POST /api/cases/:id/decision → DB row + AuditLog
```

## §2.3 Why this architecture is academically defensible

You can defend every component to a thesis committee:

- **Open weights everywhere.** Qwen2.5-VL (Apache 2.0), bge-large-en-v1.5 (MIT), bge-reranker-v2-m3 (MIT), PaddleOCR (Apache 2.0). Anyone with a CUDA workstation can rerun this without paying anyone.
- **Serverless GPU is just rented compute.** The intelligence (weights, prompts, code) is in your repo. Modal is interchangeable with RunPod, vast.ai, or a local A100 box. The architecture is the same.
- **Hybrid retrieval is the current best practice** for RAG. Dense alone is below state-of-the-art on retrieval benchmarks; BM25+dense+rerank consistently wins (see references in `PAPER.md`).
- **Async + Inngest is industry standard** for any LLM call >10s. Production systems do not do synchronous LLM calls from a serverless function.
- **Constrained decoding via Outlines** is the right answer to "guarantee JSON validity," and is itself published research.

---

# PART III — Repo layout (final state)

The repo evolves from the current single-Next.js layout to a research monorepo:

```
returnguard-ai/                                ← repo root
│
├── README.md                                  ← top-level. Results, setup, link to paper.
├── PAPER.md                                   ← 8-15 pages, paper-style writeup
├── MODEL_CARD.md                              ← per Hugging Face / Mitchell et al. (2019)
├── DATASET_CARD.md                            ← per Gebru et al. "Datasheets for Datasets"
├── ARCHITECTURE.md                            ← system design with figures
├── EVALUATION.md                              ← methodology + full results
├── CLAUDE.md                                  ← Claude Code memory (this brief is canonical)
├── RETURNGUARD_EXPERT_EDITION.md              ← this file
├── RETURNGUARD_BUILD_BRIEF.md                 ← v1 (historical, do not target)
├── LICENSE                                    ← MIT
├── docker-compose.yml                         ← Fully local reproduction
├── .env.example
├── pnpm-workspace.yaml
│
├── web/                                       ← Vercel deployment (current Next.js code, refactored)
│   ├── app/
│   │   ├── (the existing routes)
│   │   └── api/
│   │       ├── cases/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── upload/route.ts
│   │       │       ├── analyze/route.ts                      ← enqueues Inngest event, returns 202
│   │       │       ├── analysis/complete/route.ts            ← callback from Modal
│   │       │       └── decision/route.ts
│   │       ├── analytics/summary/route.ts
│   │       ├── policies/reindex/route.ts
│   │       └── inngest/route.ts                              ← Inngest handler
│   ├── components/                            (unchanged + new ProgressTracker, AnnotationPanel)
│   ├── lib/
│   │   ├── db/prisma.ts
│   │   ├── blob.ts
│   │   ├── inference-client.ts                ← thin HTTP client to Modal
│   │   └── jobs/
│   │       ├── inngest.ts                     ← Inngest client
│   │       └── analyze-case.ts                ← the durable analyze function
│   ├── prisma/
│   │   ├── schema.prisma                      ← extended schema (see Part V)
│   │   └── migrations/
│   ├── public/products/
│   ├── package.json
│   ├── next.config.mjs
│   └── vercel.json
│
├── inference/                                 ← Modal deployment (Python)
│   ├── app.py                                 ← Modal app + endpoints
│   ├── pipeline.py                            ← Orchestrator (composes modules)
│   ├── modules/
│   │   ├── __init__.py
│   │   ├── base.py                            ← BaseModule with timing + logging
│   │   ├── complaint.py                       ← Module A: Complaint analyzer (text-only LLM pass)
│   │   ├── vision.py                          ← Module B: Image analyzer (Qwen2.5-VL)
│   │   ├── ocr.py                             ← Module C: PaddleOCR + LLM field extraction
│   │   ├── rag.py                             ← Module D: hybrid retrieve + RRF + rerank + relevance filter
│   │   ├── reasoner.py                        ← Module E: final reasoning + Outlines-constrained JSON
│   │   └── critic.py                          ← Module E': self-critique loop
│   ├── retrieval/
│   │   ├── chunkers.py                        ← section-aware chunking
│   │   ├── embedders.py                       ← bge-large-en-v1.5 wrapper
│   │   ├── retrievers.py                      ← dense, BM25, hybrid (RRF)
│   │   ├── rerankers.py                       ← bge-reranker-v2-m3 wrapper
│   │   └── query_expander.py                  ← LLM rewrites case → N queries
│   ├── llm/
│   │   ├── vllm_client.py                     ← vLLM wrapper, Outlines integration
│   │   └── prompts.py                         ← loads versioned prompts
│   ├── schemas.py                             ← Pydantic schemas (mirrors Zod on web side)
│   ├── prompts/
│   │   ├── CHANGELOG.md
│   │   └── v1/
│   │       ├── complaint_analyzer.txt
│   │       ├── vision_analyzer.txt
│   │       ├── doc_extractor.txt
│   │       ├── query_expander.txt
│   │       ├── chunk_relevance.txt
│   │       ├── reasoner.txt
│   │       └── critic.txt
│   ├── tests/
│   │   ├── test_chunkers.py
│   │   ├── test_retrievers.py
│   │   ├── test_schemas.py
│   │   └── test_pipeline_e2e.py
│   ├── pyproject.toml
│   ├── uv.lock
│   └── README.md
│
├── eval/                                      ← Python eval harness (runs against Modal)
│   ├── configs/
│   │   ├── baseline_random.yaml
│   │   ├── baseline_rules.yaml
│   │   ├── text_only.yaml
│   │   ├── text_rag.yaml
│   │   ├── text_vision.yaml
│   │   └── full_system.yaml
│   ├── ablations/
│   │   ├── no_rag.yaml
│   │   ├── no_rerank.yaml
│   │   ├── no_critic.yaml
│   │   ├── no_self_consistency.yaml
│   │   └── no_query_expansion.yaml
│   ├── metrics.py                             ← Accuracy, agreement, kappa, calibration, MRR/NDCG, ECE
│   ├── bootstrap.py                           ← scipy bootstrap wrapper
│   ├── annotation.py                          ← Cohen's κ, IAA helpers
│   ├── baselines.py                           ← random + rule-based implementations
│   ├── run_baselines.py                       ← script: run all baselines, save to /results/
│   ├── run_ablations.py                       ← script: run ablation matrix
│   ├── run_full.py                            ← script: full system on all cases
│   └── README.md
│
├── notebooks/                                 ← Research narrative — the artifact students read
│   ├── 01_dataset_card.ipynb                  ← Dataset exploration, case distribution, samples
│   ├── 02_chunking_strategies.ipynb           ← Compare 3 chunk sizes by retrieval quality
│   ├── 03_embedding_models.ipynb              ← bge-large vs bge-base vs nomic vs e5
│   ├── 04_retrieval_evaluation.ipynb          ← MRR@5, NDCG@5, Recall@5 on labeled chunk relevance
│   ├── 05_baselines.ipynb                     ← All 6 baselines side-by-side
│   ├── 06_ablations.ipynb                     ← Component removal study
│   ├── 07_calibration.ipynb                   ← ECE, reliability diagrams, score-vs-accuracy
│   ├── 08_error_taxonomy.ipynb                ← Manual failure-mode coding + analysis
│   ├── 09_annotator_agreement.ipynb           ← Cohen's κ, disagreement examples
│   ├── 10_self_consistency.ipynb              ← N=5 samples, majority-vote stability
│   ├── 11_latency_cost.ipynb                  ← Per-stage profiling, tokens, GPU memory, $ per case
│   └── README.md                              ← Recommended reading order
│
├── data/
│   ├── policies/                              ← Synthetic policy KB
│   │   ├── return-policy.md
│   │   ├── replacement-policy.md
│   │   ├── warranty-policy.md
│   │   ├── technician-policy.md               ← new
│   │   └── open-box-policy.md                 ← new
│   ├── cases/                                 ← Expanded dataset (target 24 cases minimum)
│   │   ├── c001/ … c024/
│   │   │   ├── complaint.txt
│   │   │   ├── images/
│   │   │   ├── invoice.pdf
│   │   │   ├── delivery.pdf
│   │   │   ├── warranty.pdf
│   │   │   ├── expected.json                  ← gold-label decision
│   │   │   ├── annotations/                   ← per-annotator labels
│   │   │   │   ├── alif.json
│   │   │   │   ├── shahansha.json
│   │   │   │   └── vishal.json
│   │   │   └── case_metadata.json
│   │   └── README.md
│   └── retrieval_qa/                          ← Hand-labeled (query → relevant chunks) for IR eval
│       ├── queries.jsonl
│       └── relevance_labels.jsonl
│
├── results/                                   ← Experiment outputs, version-tagged
│   └── 2026-05-20_full_system_v1/
│       ├── config.yaml
│       ├── per_case.csv
│       ├── metrics.json
│       ├── confusion_matrix.png
│       ├── reliability_diagram.png
│       ├── latency_breakdown.png
│       └── README.md
│
├── docs/
│   ├── ARCHITECTURE.md                        ← System design with diagrams
│   ├── EVALUATION.md                          ← Methodology in full
│   ├── DEPLOYMENT.md                          ← Step-by-step deploy
│   ├── MIGRATION_NOTES.md                    ← v1 → expert-edition migration log
│   └── figures/                               ← .svg / .png for paper and slides
│
└── scripts/                                   ← Maintenance scripts (top level)
    ├── annotate_case.py                       ← Multi-annotator CLI helper
    ├── compute_iaa.py                         ← Inter-annotator agreement report
    └── export_paper_tables.py                 ← Build LaTeX/Markdown tables from /results/
```

---

# PART IV — Inference tier (Modal) in detail

## §4.1 Why Modal

Modal is serverless GPU. You write Python with `@app.function(gpu="A10G", volumes={...})` and `modal deploy`. It handles cold starts, GPU pool, autoscaling, scale-to-zero. The free tier is $30/month of compute — at A10G rates (~$0.001/sec) that's ~30 hours of warm inference, i.e. several thousand demo calls. Idle costs $0.

Modal is also where the AI research community publishes their inference recipes today (Modal labs blog, many recent open-source AI repos). A reviewer seeing `modal deploy` recognises this as current best practice.

## §4.2 Model choices, locked

| Role | Model | License | VRAM (with vLLM + AWQ) | Notes |
|---|---|---|---|---|
| Vision-Language Model | **Qwen2.5-VL-7B-Instruct** | Apache 2.0 | ~16 GB (A10G fits) | SOTA open-source VLM for documents and images at this size class |
| Reasoning LLM | **Qwen2.5-VL-7B-Instruct** (same model, text-only mode) | Apache 2.0 | shared | Saves a model load. If you want a larger reasoner, swap to Qwen2.5-14B-Instruct (needs A100) |
| Embeddings | **BAAI/bge-large-en-v1.5** | MIT | ~1 GB | 1024-dim; consistently top-tier on MTEB benchmark |
| Reranker | **BAAI/bge-reranker-v2-m3** | MIT | ~2 GB | Multilingual cross-encoder; the right tool for top-20 → top-5 |
| OCR | **PaddleOCR PP-OCRv4** | Apache 2.0 | CPU OK | Deterministic, fast, no LLM needed |
| Constrained JSON | **Outlines** | Apache 2.0 | n/a | Decoder-level grammar; zero invalid JSON by construction |

If hardware is generous, upgrade to Qwen2.5-VL-32B or InternVL3-78B for the VLM and Qwen2.5-32B-Instruct or Llama-3.3-70B for reasoning. The pipeline contract does not change.

## §4.3 Modal app structure

`/inference/app.py` defines the Modal app and exposes endpoints. Sketch:

```python
import modal
from pathlib import Path

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_pyproject("pyproject.toml")
    .apt_install("libgl1", "libglib2.0-0")  # for PaddleOCR
)

volume = modal.Volume.from_name("returnguard-models", create_if_missing=True)

app = modal.App("returnguard-inference", image=image)

GPU_CONFIG = "A10G"
MODEL_DIR = Path("/models")

@app.cls(
    gpu=GPU_CONFIG,
    volumes={MODEL_DIR: volume},
    container_idle_timeout=300,
    timeout=600,
    secrets=[modal.Secret.from_name("returnguard-secrets")],
)
class InferenceService:
    @modal.enter()
    def load_models(self):
        from inference.llm.vllm_client import load_vllm
        from inference.retrieval.embedders import load_embedder
        from inference.retrieval.rerankers import load_reranker
        from inference.modules.ocr import load_ocr

        self.vlm = load_vllm("Qwen/Qwen2.5-VL-7B-Instruct", model_dir=MODEL_DIR)
        self.embedder = load_embedder("BAAI/bge-large-en-v1.5", model_dir=MODEL_DIR)
        self.reranker = load_reranker("BAAI/bge-reranker-v2-m3", model_dir=MODEL_DIR)
        self.ocr = load_ocr()

    @modal.method()
    def pipeline(self, case_payload: dict) -> dict:
        from inference.pipeline import run_pipeline
        return run_pipeline(case_payload, self.vlm, self.embedder, self.reranker, self.ocr)

    @modal.method()
    def embed(self, texts: list[str]) -> list[list[float]]:
        return self.embedder.encode(texts).tolist()

    @modal.method()
    def healthcheck(self) -> dict:
        return {"status": "ok", "models_loaded": True}

# Webhook entry for Vercel to call
@app.function(timeout=600, secrets=[modal.Secret.from_name("returnguard-secrets")])
@modal.fastapi_endpoint(method="POST")
def analyze(case_payload: dict, authorization: str = modal.Cookie()):
    # token check
    expected = os.environ["INFERENCE_API_TOKEN"]
    if authorization != f"Bearer {expected}":
        return {"error": "unauthorized"}, 401
    service = InferenceService()
    return service.pipeline.remote(case_payload)
```

## §4.4 The decoupled pipeline

`/inference/pipeline.py`:

```python
def run_pipeline(case, vlm, embedder, reranker, ocr, *, config: PipelineConfig) -> AnalysisResult:
    stage_log = []

    # 1. Complaint analyzer (text-only LLM)
    with timer() as t:
        complaint_features = complaint.run(case.complaint_text, vlm)
    stage_log.append(("complaint", t.elapsed_ms))

    # 2. OCR + structured field extraction
    with timer() as t:
        extracted_fields = ocr.run(case.documents, vlm)
    stage_log.append(("ocr", t.elapsed_ms))

    # 3. Vision analyzer
    with timer() as t:
        visual_features = vision.run(case.images, case.product_metadata, vlm)
    stage_log.append(("vision", t.elapsed_ms))

    # 4. RAG
    with timer() as t:
        query_set = rag.expand_query(case, complaint_features, vlm)
        candidates = rag.hybrid_retrieve(query_set, embedder, k=20)
        reranked = rag.rerank(query_set, candidates, reranker, k=5)
        filtered = rag.relevance_filter(reranked, case, vlm)
    stage_log.append(("rag", t.elapsed_ms))

    # 5. Reasoner with self-consistency (N=config.n_samples)
    with timer() as t:
        samples = [reasoner.run(case, complaint_features, visual_features,
                                extracted_fields, filtered, vlm)
                   for _ in range(config.n_samples)]
        primary = reasoner.majority_vote(samples)
    stage_log.append(("reason", t.elapsed_ms))

    # 6. Self-critique
    if config.use_critic:
        with timer() as t:
            critique = critic.run(primary, filtered, vlm)
            if critique.needs_revision:
                primary = reasoner.run(case, ..., filtered, vlm, critique=critique)
        stage_log.append(("critic", t.elapsed_ms))

    # 7. Final assembly
    return AnalysisResult(
        appendix_a=primary,
        retrieved_chunks=filtered,
        stage_log=stage_log,
        config=config,
    )
```

**Why this matters for ablations:** swap `PipelineConfig` flags and rerun. No code changes needed for the ablation matrix.

## §4.5 Hybrid retrieval — exact recipe

`/inference/retrieval/retrievers.py`:

```python
def hybrid_retrieve(queries: list[str], embedder, k: int = 20) -> list[Candidate]:
    """For each query: dense top-k + BM25 top-k, fuse via RRF, dedupe, return top-k overall."""
    pools = []
    for q in queries:
        dense_hits = dense_retrieve(q, embedder, k=k)
        sparse_hits = bm25_retrieve(q, k=k)
        fused = reciprocal_rank_fusion([dense_hits, sparse_hits], k_const=60)
        pools.append(fused)
    return dedupe_and_top_k(flatten(pools), k=k)
```

- **Dense retrieval**: cosine on bge-large-en-v1.5 embeddings, stored in pgvector. Postgres query exactly as in v1.
- **BM25**: implemented either with the `rank_bm25` Python lib over an in-memory corpus (10–20 chunks fits trivially) or with Postgres `tsvector` + `ts_rank_cd`. Either is fine; pick by ease of test-coverage.
- **Reciprocal Rank Fusion**: standard RRF formula `score(d) = Σ_i 1/(k + rank_i(d))`, k=60 is the literature default.
- **Reranker**: bge-reranker-v2-m3 scores each (query, chunk) pair, sort, keep top-5.
- **Relevance filter** (Self-RAG-flavoured): for each surviving chunk, ask the VLM "is this chunk relevant to deciding this case? yes/no with one-sentence reason." Drop the no's. Logged.

## §4.6 Constrained JSON output

vLLM + Outlines guarantees the output matches a Pydantic schema at decode time. No retry-on-invalid hacks needed. The reasoner is invoked as:

```python
from outlines import models, generate
model = models.vllm(self.vlm)  # already loaded
generator = generate.json(model, AppendixASchema)
result: AppendixASchema = generator(prompt, max_tokens=2048)
```

JSON validity rate becomes 100.0% by construction. This is the right way and is itself a paper-citable technique.

## §4.7 Self-consistency

For each case the reasoner runs N=5 times at `temperature=0.3, top_p=0.9`. Vote on `recommended_action`. Report agreement among samples as a per-case confidence indicator. Cases with 5/5 agreement get a "high" confidence flag; 3/5 splits get auto-escalated to manager.

## §4.8 Self-critique

`critic.run()` takes the primary reasoner output and the retrieved chunks, prompts a fresh inference pass: "Review the above analysis. Identify (a) any claim not supported by the cited chunks, (b) any cited chunk that doesn't actually support the claim, (c) any contradictions between visual_features and complaint_features that the reasoner missed. Return JSON with `needs_revision: bool, issues: list[str], suggested_corrections: list[str]`."

If `needs_revision=true`, reasoner runs once more with the critic feedback appended. Both runs are logged. This is a faithful implementation of the "critique–revise" pattern from Reflexion / SELF-RAG.

---

# PART V — Web tier (Vercel) extensions

## §5.1 Extended Prisma schema

The v1 schema gains four tables for research telemetry and one for annotations:

```prisma
model ExperimentRun {
  id          String   @id @default(cuid())
  name        String   // e.g. "full_system_v3"
  config      Json     // PipelineConfig snapshot
  modelTag    String   // "Qwen2.5-VL-7B@a1b2c3"
  promptVersion String // "v3"
  startedAt   DateTime @default(now())
  finishedAt  DateTime?
  analyses    AiAnalysis[]
}

model StageLog {
  id          String   @id @default(cuid())
  analysisId  String
  analysis    AiAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  stage       String   // "complaint" | "ocr" | "vision" | "rag" | "reason" | "critic"
  latencyMs   Int
  tokensIn    Int?
  tokensOut   Int?
  gpuPeakMb   Int?
  metadata    Json?
  @@index([analysisId])
}

model RetrievedChunk {
  id            String   @id @default(cuid())
  analysisId    String
  analysis      AiAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  chunkId       String
  policyName    String
  sectionRef    String
  denseScore    Float?
  sparseScore   Float?
  fusedScore    Float?
  rerankScore   Float?
  relevanceKept Boolean
  relevanceReason String?
  rankPosition  Int
  @@index([analysisId])
}

model Annotation {
  id          String   @id @default(cuid())
  caseId      String
  case        Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  annotator   String   // alif | shahansha | vishal
  decision    String
  rationale   String   @db.Text
  confidence  Int      // 1-5 Likert
  annotatedAt DateTime @default(now())
  @@unique([caseId, annotator])
}

// Extend AiAnalysis with selfConsistency + critique fields:
model AiAnalysis {
  // ... existing fields ...
  experimentRunId       String?
  experimentRun         ExperimentRun? @relation(fields: [experimentRunId], references: [id])
  selfConsistencySamples Json?         // N votes by recommendation
  selfConsistencyAgree  Float?         // 0..1
  criticRunCount        Int            @default(0)
  criticIssuesFound     Json?
  stageLogs             StageLog[]
  retrievedChunkLogs    RetrievedChunk[]
}
```

## §5.2 Async via Inngest

Inngest is the right answer because:
- Native Next.js integration (`app/api/inngest/route.ts`)
- Durable: if Modal times out, Inngest retries with exponential backoff
- Free tier: 50k step executions/month
- Generates a dashboard of every job run — useful in the demo

`/web/lib/jobs/analyze-case.ts`:

```typescript
import { inngest } from "./inngest";

export const analyzeCase = inngest.createFunction(
  { id: "analyze-case", retries: 2 },
  { event: "case.analyze.requested" },
  async ({ event, step }) => {
    const { caseId } = event.data;

    const caseData = await step.run("load-case", () => loadCaseFromDb(caseId));
    await step.run("set-analyzing", () => updateCaseStatus(caseId, "analyzing"));

    const result = await step.run("modal-pipeline", () =>
      callModalPipeline(caseData, { timeoutMs: 300_000 })
    );

    await step.run("persist-analysis", () => persistAnalysis(caseId, result));
    await step.run("set-analyzed", () => updateCaseStatus(caseId, "analyzed"));

    return { caseId, analysisId: result.analysisId };
  }
);
```

The `/api/cases/:id/analyze` route just emits the event and returns 202. Frontend polls `/api/cases/:id` every 2s. UI shows per-stage progress by querying `StageLog` while the analysis is in flight.

## §5.3 UI additions

- **Progress tracker** on the dashboard during analysis: 6 progress dots (complaint → ocr → vision → rag → reason → critic), each turning green as the corresponding StageLog row appears.
- **Self-consistency widget**: shows the N=5 vote distribution as a small bar chart on the score card.
- **Critic feedback panel**: if `criticRunCount > 0`, show the issues found and the resulting revision.
- **Retrieved-chunk explorer**: in the Policy tab, show each chunk with its dense score, sparse score, fused score, rerank score, and a "kept by relevance filter? yes/no" toggle, all from the `RetrievedChunk` rows.
- **Annotation panel**: on `/cases/[id]?annotate=1`, show a form where each team member submits their independent label. The `/notebooks/09_annotator_agreement.ipynb` reads from `Annotation` rows.
- **Experiment selector** on `/analytics`: lets you compare metrics across `ExperimentRun` rows side by side.

---

# PART VI — Prompts (versioned)

`/inference/prompts/CHANGELOG.md` tracks every prompt change with rationale. Example structure:

```
# Prompt Changelog

## v3 (2026-05-22)
- reasoner.txt: added explicit rule "if visual_uncertainty != ''
  AND complaint_category == 'functional_issue' THEN recommended_action
  != 'approve_replacement'". Rationale: in v2, C001 incorrectly
  recommended approval despite a no-cooling complaint with only
  external photos. See notebooks/08_error_taxonomy.ipynb §3.

## v2 (2026-05-21)
- query_expander.txt: added system role "you are paraphrasing for
  retrieval, not interpreting"; reduced rewriting of product terms.
  Rationale: v1 was hallucinating model names into queries.

## v1 (2026-05-20)
- Initial prompt set, ported from old Gemini system prompt with
  edits for open-weight models.
```

Each prompt is a `.txt` file with Jinja-style placeholders. Loaded via:

```python
from inference.llm.prompts import load_prompt
sys, user = load_prompt("reasoner", version="v3", **template_vars)
```

This gives you a clean A/B test: run the same case through v2 and v3, diff the outputs, log to `/results/`.

The full prompt text for v1 is given in `/inference/prompts/v1/*.txt` (Claude Code will write these in Phase 4 of Part X below; the rules from v1 brief §6.1 carry over, plus the additional rules for the decoupled architecture).

---

# PART VII — Evaluation methodology (the research core)

## §7.1 The experimental matrix

The eval directory runs **6 system configurations × 24 cases = 144 case-level results** for the headline table.

| ID | Configuration | Vision? | RAG? | Rerank? | Self-cons? | Critic? |
|---|---|---|---|---|---|---|
| B0 | Random | – | – | – | – | – |
| B1 | Rule-based (regex over complaint + policy keywords) | – | – | – | – | – |
| B2 | Text-only LLM | – | – | – | – | – |
| B3 | Text + RAG | – | ✓ | – | – | – |
| B4 | Text + RAG + Vision | ✓ | ✓ | – | – | – |
| FULL | Full system | ✓ | ✓ | ✓ | ✓ (N=5) | ✓ |

Plus ablations on FULL:

| ID | Removed from FULL |
|---|---|
| ABL-1 | – query expansion |
| ABL-2 | – BM25 (dense only) |
| ABL-3 | – reranker |
| ABL-4 | – relevance filter |
| ABL-5 | – self-consistency (N=1) |
| ABL-6 | – critic |

12 configurations × 24 cases = 288 runs. On Modal A10G at ~10s/run that's ~50 minutes of compute — fits in the free tier comfortably.

## §7.2 Metrics — what we report

### Technical
- **Exact-match accuracy** on `recommended_action` with 95% bootstrap CI (`scipy.stats.bootstrap`, n_resamples=1000).
- **Near-match accuracy** (exact or "acceptable alternative" per `expected.json`) with CI.
- **Per-category accuracy**: functional_issue / visible_damage / cosmetic / missing_accessory / contradiction.
- **JSON validity rate** — should be 100% with Outlines; report anyway.
- **Policy citation rate** — fraction of analyses citing ≥1 policy chunk.
- **Citation faithfulness rate** — manual audit: does the cited chunk actually support the claim? Sample n=30 (claim, chunk) pairs, three-annotator vote.
- **Contradiction recall** — fraction of cases with `expected_contradictions != []` where the model flagged a contradiction.

### Retrieval (over `/data/retrieval_qa/`)
- **Recall@5** — fraction of gold-relevant chunks present in top-5.
- **MRR@5** — mean reciprocal rank of the first relevant chunk.
- **nDCG@5** — normalised discounted cumulative gain.

### Calibration
- **Expected Calibration Error (ECE)** with 10 bins on RVS → accuracy.
- **Reliability diagram** plotted alongside.

### Statistical
- **Cohen's κ** for inter-annotator agreement (target ≥ 0.6 = substantial agreement).
- **Confusion matrix** of predicted × expected decision (6×6).
- **Per-stage latency**: median + p95 from `StageLog`.
- **Tokens consumed** per case, mean and total.
- **GPU memory peak** per stage.
- **Cost per case** in USD (Modal $0.001/sec × runtime).

### Business (proposal §19.2)
- **Technician visits avoided** count.
- **Open-unit losses prevented** (sum of `avoidedCost()` over recommendations != approve_replacement).
- **Projected monthly saving** at 4× demo volume — explicitly disclosed as an extrapolation, not a measurement.

## §7.3 Annotation protocol

Each of the 24 cases is independently labelled by all three team members **before** the eval is run. Each annotator:

1. Reads the case fixture (complaint + images + invoice + policy KB summary).
2. Without seeing the AI output, fills out `data/cases/cXXX/annotations/<name>.json`:
   ```json
   {
     "annotator": "alif",
     "decision": "remote_troubleshooting",
     "confidence": 4,
     "rationale": "Functional issue (no cooling), no visible damage, return window expired. Per policy §3.2 functional issues after window require diagnosis.",
     "annotated_at": "2026-05-19T10:14:00Z"
   }
   ```
3. After all annotators submit, the team meets and produces a `expected.json` adjudicated label with the rationale recorded.

`scripts/compute_iaa.py` reads all `annotations/*.json` files and computes pairwise Cohen's κ. Report all pairwise values + the average. Disagreement examples go into `notebooks/09_annotator_agreement.ipynb`.

## §7.4 Error taxonomy

Every failure is categorised into one of:

| Code | Category | Example |
|---|---|---|
| E1 | Retrieval miss (no relevant chunk in top-5) | Case asks about cosmetic damage but reranker dropped §2.4 |
| E2 | Hallucinated fact (claim not in any cited chunk) | "Warranty void per §5.1" but §5.1 says no such thing |
| E3 | Image misread (vision module wrong about what's visible) | Photo shows broken hinge; vision says "no visible damage" |
| E4 | Policy misinterpretation (chunk retrieved but reasoner misapplies it) | Reads §3.2 correctly but applies the wrong threshold |
| E5 | Schema violation (impossible with Outlines but logged anyway) | – |
| E6 | Contradiction missed | C007 — claim says dented, photo undamaged, model didn't flag |
| E7 | Over-conservative routing (e.g. always recommending evidence) | The current v1 behaviour |
| E8 | Over-confident approval (recommending approve when functional claim) | The dangerous failure mode |

Every case in `/results/*/per_case.csv` has an `error_code` column populated by manual review. `notebooks/08_error_taxonomy.ipynb` builds the histogram and discusses dominant modes.

## §7.5 Honest reporting rule

Every headline metric reported with `n<30` must include the 95% bootstrap CI. No exceptions. "100% on 8/8" is not a result; "100% [95% CI 71%–100%]" is. The wide interval *is the point* — it tells the reviewer how much we can or cannot conclude from this sample size.

---

# PART VIII — Research deliverables

## §8.1 `PAPER.md` outline

```
1. Abstract  (200 words)
2. Introduction
   2.1 Business problem
   2.2 Why current decision processes fail
   2.3 Contributions of this work
3. Related Work
   3.1 Multimodal RAG (Lewis et al., RAG-Token; Self-RAG; CRAG)
   3.2 Document-AI for invoices (LayoutLM family; Donut; trOCR)
   3.3 Vision-language models (LLaVA, Qwen-VL, InternVL)
   3.4 Human-in-the-loop decision support
4. System Design
   4.1 Architecture overview
   4.2 The six modules
   4.3 RAG pipeline (hybrid + rerank + self-RAG)
   4.4 Constrained decoding for structured output
   4.5 Self-consistency and self-critique
5. Dataset
   5.1 Synthetic case construction
   5.2 Policy knowledge base
   5.3 Annotation protocol (Cohen's κ = 0.7X)
6. Experiments
   6.1 Baselines and ablations
   6.2 Retrieval evaluation
   6.3 Calibration
   6.4 Latency and cost
7. Results
   7.1 Headline accuracy table (with CIs)
   7.2 Ablation table
   7.3 Per-category breakdown
   7.4 Error analysis
8. Discussion
   8.1 What the model is good at
   8.2 What it is bad at (the dangerous failure mode E8)
   8.3 Implications for human-AI handoff in returns
9. Limitations
   9.1 Synthetic data — generalisation untested
   9.2 Small sample size — CIs are wide
   9.3 Single client domain
   9.4 No real customer PII / no field deployment
10. Future Work
11. Reproducibility statement
12. Ethical considerations (governance, advisory-only, bias)
13. References
```

## §8.2 `MODEL_CARD.md` — follows Mitchell et al. 2019

Required sections:
- Model details (name, version, type, dates, license)
- Intended use
- Out-of-scope use cases
- Factors (relevant for evaluation)
- Metrics (with CIs)
- Evaluation data
- Training data ("None — used pre-trained Qwen2.5-VL-7B and bge models; only fine-tuning is the prompt set, version v3")
- Quantitative analyses (the eval table)
- Ethical considerations
- Caveats and recommendations

## §8.3 `DATASET_CARD.md` — follows Gebru et al. "Datasheets"

- Motivation, composition, collection process
- Preprocessing/cleaning/labeling
- Uses, distribution, maintenance
- Sensitive content (none — synthetic)
- IAA scores

## §8.4 Notebooks — recommended reading order

The notebooks tell the story. A student reading them in order should be able to reproduce every number in the paper. They are the primary research artefact, more than the web demo.

---

# PART IX — Proposal coverage matrix v2

Every section of the original PDF maps to a file in this new architecture. This supersedes v1 §17.

| Proposal § | Topic | Where in code (expert edition) |
|---|---|---|
| §1 Executive Summary | Pitch | `README.md` + `PAPER.md` §1 |
| §3 Business Problem | Cost leakage | `PAPER.md` §2 + `web/lib/cost.ts` |
| §4 Proposed Solution | Web platform | `web/app/` + `inference/` |
| §5.2 Specific Objectives 1–7 | Case intake, doc intel, image analysis, RAG, RVS, explainability, evaluation | Each maps to a module: `web/app/api/cases/**`, `inference/modules/{ocr,vision,rag,reasoner}.py`, `web/lib/ai/score.ts` (kept), `eval/` |
| §5.3 RQ1–RQ5 | Research questions | `notebooks/05_baselines.ipynb` + `notebooks/06_ablations.ipynb` + `EVALUATION.md` |
| §6.1 Multimodal Learning | Text + image + doc fused | `inference/pipeline.py` orchestration |
| §6.2 RAG | Chunk + embed + retrieve + **rerank + RRF + relevance filter** | `inference/retrieval/` (all sub-files) |
| §6.3 Human-in-the-Loop | Manager always final | `web/components/decision-panel.tsx` + `ManagerDecision` table + governance banner |
| §6.4 Evidence Fusion | Structured JSON | `inference/schemas.py` (Pydantic) + `web/lib/ai/schema.ts` (Zod) mirror |
| §7 Model Foundations | Hybrid track | **Open-weight** — Qwen2.5-VL-7B, bge family, PaddleOCR — all in `inference/llm/` and `inference/retrieval/` |
| §8 System Architecture | 6 layers | `ARCHITECTURE.md` + Part II of this brief |
| §9 End-to-End Workflow | 8-step case flow | `web/lib/jobs/analyze-case.ts` (Inngest) + `inference/pipeline.py` |
| §10 Modules A–F | 6 conceptual modules | **Decoupled**: `inference/modules/{complaint,vision,ocr,rag,reasoner,critic}.py` + `web/components/decision-panel.tsx` + `web/lib/db/audit.ts` |
| §11.2 Chunking | 300–600 tokens, 50–100 overlap | `inference/retrieval/chunkers.py` — section-aware |
| §11.3 Retrieval Formula | Cosine similarity + RRF + cross-encoder rerank | `inference/retrieval/retrievers.py` + `rerankers.py` |
| §11.4 RAG Guardrails | 5 safety rules | Encoded in `inference/prompts/v*/reasoner.txt` + Pydantic enforces; relevance filter further enforces |
| §12.1 RVS formula | Weighted score | `web/lib/ai/score.ts` (kept) |
| §12.2 Recommendation thresholds | 0–30/31–50/51–70/71–85/86–100 | `web/lib/ai/score.ts` `thresholdSanityCheck()` |
| §12.3 Contradiction handling | Flag inconsistencies | `inference/prompts/v*/reasoner.txt` + `contradictions[]` field in schema + red banner in UI + explicit **C007 test** |
| §13 Dataset | 50–100 cases | 24 cases in `data/cases/` with **multi-annotator labels** + IAA reported. Honest scope note. |
| §13.3 Data Privacy | Synthetic | All `data/cases/` synthetic |
| §14 Database tables | 7 tables | `web/prisma/schema.prisma` — extended with `ExperimentRun`, `StageLog`, `RetrievedChunk`, `Annotation` |
| §15 API endpoints | 8 routes | `web/app/api/**` |
| §15.2 Backend orchestration | `analyze_case(case_id)` pseudocode | `web/lib/jobs/analyze-case.ts` (Inngest) → `inference/pipeline.py` |
| §16 UI design | Score + tabs + decision | `web/app/cases/[id]/page.tsx` + new ProgressTracker + Self-Consistency widget + Retrieved-Chunk Explorer |
| §17 Roadmap | 8 phases | Expert-edition phases in Part X of this brief |
| §18 Prompt Engineering | Schema + repair loop | **Replaced** with Outlines grammar-constrained decoding — JSON validity guaranteed at decode time |
| §19 Evaluation Methodology | 7+ metrics | `eval/` + `notebooks/` + `EVALUATION.md` — now with baselines, ablations, CIs, calibration, IAA, error taxonomy |
| §20 Cost-Saving Model | 150+80+100+OpenBox AED | `web/lib/cost.ts` + `notebooks/11_latency_cost.ipynb` |
| §21 Deployment + Security | Vercel + 6 controls | `DEPLOYMENT.md` + Inngest auth + Modal bearer token + Vercel env vars |
| §22 Risks & Mitigations | 8 risks | `PAPER.md` §9 + `MODEL_CARD.md` ethical considerations |
| §23 Deliverables | 7 outputs | Checklist in §11.4 below — every item present |
| Appendix A | Output JSON schema | `inference/schemas.py` (Pydantic) authoritative; `web/lib/ai/schema.ts` (Zod) mirror generated |
| Appendix B | SQL schema | `web/prisma/schema.prisma` |
| Appendix C | Example prompts | Consolidated and versioned in `inference/prompts/v*/` |

---

# PART X — Claude Code CLI execution plan

Phased migration. Each phase ends in a **verification command** and an **acceptance criterion**. Stop after each phase, confirm green, then proceed. **Do not skip verification.**

> ### Phase 0 — Bootstrap and orient
>
> **Paste to Claude Code:**
> ```
> Read CLAUDE.md and RETURNGUARD_EXPERT_EDITION.md in full. Then read the
> existing repo state — particularly the lib/ai/ directory, prisma/schema.prisma,
> evaluation-report.md, and README.md — to understand what is being migrated FROM.
>
> Reply with:
> 1. A 5-bullet summary of the migration scope (what changes, what stays).
> 2. A list of the existing files that will be deleted, modified, or kept.
> 3. Any clarifying questions before Phase 1.
>
> Do not write any code in this turn. Wait for my confirmation.
> ```
>
> **Acceptance:** Claude Code correctly identifies that `lib/ai/gemini.ts`, `lib/ai/analyze.ts`, `lib/ai/embeddings.ts`, `lib/ai/retrieve.ts`, `lib/ai/prompts.ts` will be rewritten to be thin clients to Modal, and that `inference/`, `eval/`, `notebooks/`, `data/cases/c00*/annotations/`, and the top-level paper docs will be added.

---

> ### Phase 1 — Monorepo refactor + new folders
>
> **Paste to Claude Code:**
> ```
> Execute the repo-layout migration in Part III of RETURNGUARD_EXPERT_EDITION.md.
> Steps:
> 1. Move the existing Next.js app into a `web/` directory at repo root. Update
>    `package.json` and `pnpm-workspace.yaml` for a monorepo. Update vercel.json
>    so the Vercel deployment builds from `web/`.
> 2. Create empty directory structure for `inference/`, `eval/`, `notebooks/`,
>    `data/retrieval_qa/`, `data/cases/c00*/annotations/`, `results/`, `docs/`.
> 3. Create stub README.md files in each new directory describing its purpose.
> 4. Add top-level `PAPER.md`, `MODEL_CARD.md`, `DATASET_CARD.md`,
>    `ARCHITECTURE.md`, `EVALUATION.md`, `docs/MIGRATION_NOTES.md` with
>    placeholder section headers per the outlines in Parts VII–VIII.
> 5. Update top-level README to describe the monorepo layout and point at
>    PAPER.md as the canonical research artefact.
>
> Do not delete `lib/ai/*.ts` yet — they will be refactored in Phase 5.
> Stop and report.
> ```
>
> **Verification:**
> ```bash
> ls -la                        # should show web/, inference/, eval/, notebooks/, …
> cd web && pnpm dev            # Next.js still boots
> cat PAPER.md                  # Outline placeholder present
> ```
> **Acceptance:** Vercel builds still pass against `web/`. New directories exist with stub READMEs.

---

> ### Phase 2 — Extend the Prisma schema
>
> **Paste to Claude Code:**
> ```
> Add the four new tables and AiAnalysis field extensions from Part V §5.1 of
> RETURNGUARD_EXPERT_EDITION.md to `web/prisma/schema.prisma`. Generate the
> migration. Update `web/lib/db/prisma.ts` if needed.
>
> Also create `scripts/compute_iaa.py` (top-level) that reads
> `data/cases/c00*/annotations/*.json` and prints pairwise Cohen's kappa.
>
> Stop and report.
> ```
>
> **Verification:**
> ```bash
> cd web && pnpm prisma migrate dev --name add_research_tables
> pnpm prisma studio   # confirm new tables exist
> ```
> **Acceptance:** ExperimentRun, StageLog, RetrievedChunk, Annotation tables present. Existing migrations still apply cleanly to a fresh DB.

---

> ### Phase 3 — Inference tier scaffold (Python + Modal)
>
> **Paste to Claude Code:**
> ```
> Build the inference tier per Part IV of RETURNGUARD_EXPERT_EDITION.md.
> Specifically:
> 1. Create `inference/pyproject.toml` with deps: modal, vllm, outlines,
>    sentence-transformers, FlagEmbedding, paddleocr, pydantic, structlog,
>    pillow, pymupdf, rank_bm25.
> 2. Create `inference/schemas.py` mirroring the Appendix A JSON shape as a
>    Pydantic model named AppendixA. Include sub-models for ComplaintAnalysis,
>    VisualAnalysis, DocumentAnalysis, PolicyAnalysis. Required fields per
>    Appendix A, with Field(...) descriptions.
> 3. Create `inference/app.py` per Part IV §4.3 — Modal app, InferenceService
>    class with @modal.enter() loading the four models from a persistent
>    Volume, three @modal.method() methods (pipeline, embed, healthcheck),
>    and an HTTP endpoint via @modal.fastapi_endpoint.
> 4. Create empty module files: `inference/modules/{base,complaint,vision,
>    ocr,rag,reasoner,critic}.py` each with a typed `run()` signature stub.
> 5. Create `inference/llm/vllm_client.py` and `inference/llm/prompts.py`
>    with the prompt-loading helper.
> 6. Create `inference/retrieval/{chunkers,embedders,retrievers,rerankers,
>    query_expander}.py` with typed stubs.
> 7. Add `inference/README.md` with `modal setup` and `modal deploy` steps.
>
> Stop and report. Do not implement modules yet.
> ```
>
> **Verification:**
> ```bash
> cd inference && uv sync && uv run python -c "import inference.schemas; print(inference.schemas.AppendixA.model_json_schema())"
> modal deploy app.py   # should succeed; healthcheck endpoint live
> ```
> **Acceptance:** `AppendixA` Pydantic schema importable. Modal app deploys. `/healthcheck` returns 200.

---

> ### Phase 4 — Prompts v1
>
> **Paste to Claude Code:**
> ```
> Create `inference/prompts/v1/` with seven .txt files per the list in Part VI:
> complaint_analyzer.txt, vision_analyzer.txt, doc_extractor.txt,
> query_expander.txt, chunk_relevance.txt, reasoner.txt, critic.txt.
>
> Each prompt:
> - Has a SYSTEM section and a USER section separated by `---`.
> - Uses {{double_brace}} Jinja placeholders.
> - Carries over the rules from RETURNGUARD_BUILD_BRIEF.md §6.1 (the original
>   master prompt), but adapted to each decoupled module's job.
> - The reasoner prompt enforces all 5 RAG guardrails (§11.4) and the
>   contradiction-detection rule (§12.3).
>
> Also create `inference/prompts/CHANGELOG.md` with a v1 entry describing the
> initial port from the v1 Gemini-era prompt.
>
> Stop and report.
> ```
>
> **Acceptance:** Seven prompt files present, each <2KB, with SYSTEM/USER sections. Loaded successfully by `inference/llm/prompts.py`.

---

> ### Phase 5 — Implement modules incrementally
>
> Run these as five separate Claude Code interactions:
>
> 5a. `inference/retrieval/embedders.py` + `rerankers.py` + `chunkers.py`. Verify with `uv run pytest inference/tests/test_chunkers.py inference/tests/test_retrievers.py`.
>
> 5b. `inference/retrieval/retrievers.py` (dense + BM25 + RRF) + `query_expander.py`. Verify against `data/retrieval_qa/` — Recall@5 must be > 0.5 on hand-labeled queries.
>
> 5c. `inference/modules/ocr.py` (PaddleOCR + LLM field extractor) + `inference/modules/vision.py` (Qwen2.5-VL on images). Verify on one fixture each.
>
> 5d. `inference/modules/complaint.py` + `inference/modules/reasoner.py` (with Outlines grammar) + `inference/modules/critic.py`. Verify reasoner produces a valid `AppendixA` instance on a fixture case.
>
> 5e. `inference/pipeline.py` (the orchestrator). Verify e2e on case C002 — pipeline returns an `AppendixA` instance and a stage_log with 6 entries.

---

> ### Phase 6 — Wire web tier to Modal via Inngest
>
> **Paste to Claude Code:**
> ```
> Wire the web tier to call Modal asynchronously per Part V §5.2.
> 1. Add Inngest dep to web/, create web/app/api/inngest/route.ts.
> 2. Create web/lib/jobs/inngest.ts (client) and web/lib/jobs/analyze-case.ts
>    (the durable function with steps: load-case, set-analyzing, modal-pipeline,
>    persist-analysis, set-analyzed).
> 3. Create web/lib/inference-client.ts — typed HTTPS client to the Modal
>    endpoint, with bearer token from MODAL_INFERENCE_TOKEN env var.
> 4. Refactor web/app/api/cases/[id]/analyze/route.ts to: validate, emit
>    inngest event, return 202 with jobId.
> 5. Create web/app/api/cases/[id]/analysis/complete/route.ts — the callback
>    from Modal (optional if using the synchronous pipeline.remote(); include
>    for resilience).
> 6. Delete web/lib/ai/gemini.ts, web/lib/ai/embeddings.ts,
>    web/lib/ai/retrieve.ts — these are now obsolete (Modal handles all that).
>    Keep web/lib/ai/score.ts (deterministic RVS recomputation, useful as
>    sanity check) and web/lib/ai/schema.ts (refactor to match Pydantic
>    AppendixA exactly).
> 7. Update .env.example with MODAL_INFERENCE_URL, MODAL_INFERENCE_TOKEN,
>    INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY.
>
> Stop and report.
> ```
>
> **Verification:**
> ```bash
> cd web && pnpm dev           # in one terminal
> npx inngest-cli@latest dev   # in another
> # In browser, run analyze on case C002. Inngest dashboard shows the durable run.
> # Modal logs show the pipeline.remote() call. AiAnalysis row appears in DB.
> ```
> **Acceptance:** End-to-end analyze flow works locally with Modal. Stage log rows populated.

---

> ### Phase 7 — UI extensions
>
> **Paste to Claude Code:**
> ```
> Build the four new UI components from Part V §5.3:
> - components/progress-tracker.tsx (6 dots, fed by StageLog polling)
> - components/self-consistency-widget.tsx (vote distribution bar chart)
> - components/critic-feedback-panel.tsx (shown when criticRunCount > 0)
> - components/retrieved-chunk-explorer.tsx (replaces the simple Policy tab)
>
> Add an /annotate route at web/app/cases/[id]/annotate/page.tsx — a form
> that submits to a new POST /api/cases/:id/annotate endpoint, which writes
> an Annotation row scoped by the current role-switcher value.
>
> Stop and report.
> ```
>
> **Acceptance:** All four widgets render on `/cases/[id]` after running analysis. Annotate route accepts independent labels and writes Annotation rows.

---

> ### Phase 8 — Expand dataset to 24 cases with multi-annotator labels
>
> **Paste to Claude Code:**
> ```
> Generate 16 additional synthetic cases (c009 … c024) covering edge cases not
> in the current 8. Each case has: complaint.txt, images/, invoice.pdf,
> delivery.pdf, warranty.pdf, expected.json, case_metadata.json, and an empty
> annotations/ directory.
>
> Then prompt me (the user) to fill annotations/{alif,shahansha,vishal}.json
> for all 24 cases per the protocol in Part VII §7.3. After I confirm
> annotations are filled, run scripts/compute_iaa.py and add the Cohen's kappa
> result to DATASET_CARD.md.
>
> Coverage targets (at least one case each):
> - Functional issue, photos only (E1 risk)
> - Functional issue, with video evidence
> - Visible damage, clear, in window
> - Visible damage, clear, out of window
> - Cosmetic, in window, opened unit
> - Cosmetic, in window, sealed unit (return-policy edge case)
> - Missing accessory, listed on invoice
> - Missing accessory, not listed on invoice
> - Wrong model delivered
> - Warranty void due to misuse evidence
> - Contradiction case (complaint vs visual)
> - Contradiction case (complaint vs delivery note)
> - VIP customer / high-value
> - Repeat claim from same customer (history flag)
> - Third-party installer involved
> - Out-of-region delivery (logistics dispute)
>
> Stop and report.
> ```
>
> **Acceptance:** 24 cases on disk. After user annotates: `scripts/compute_iaa.py` reports κ ≥ 0.6 across pairwise comparisons.

---

> ### Phase 9 — Eval harness + baselines + ablations
>
> **Paste to Claude Code:**
> ```
> Build the eval/ directory per Part VII §7.1.
> 1. eval/configs/*.yaml — six baseline configs + five ablation configs.
> 2. eval/baselines.py — implement B0 (random) and B1 (rule-based regex over
>    policy keywords). B2-FULL all dispatch through pipeline.py with
>    PipelineConfig flags.
> 3. eval/metrics.py — exact accuracy, near accuracy, per-category accuracy,
>    JSON validity, citation rate, citation faithfulness, contradiction
>    recall, Recall@5, MRR@5, nDCG@5, ECE.
> 4. eval/bootstrap.py — scipy.stats.bootstrap wrapper that returns
>    {mean, ci_low, ci_high}.
> 5. eval/run_baselines.py and eval/run_ablations.py — runners that
>    iterate cases, call Modal, write per_case.csv and metrics.json to
>    results/YYYY-MM-DD_<name>/.
> 6. eval/annotation.py — Cohen's kappa, confusion matrix.
>
> Stop and report. Then I will run the eval suite and feed back results.
> ```
>
> **Acceptance:** Running `uv run python eval/run_baselines.py` and `eval/run_ablations.py` writes 12 result directories with config + metrics + per_case CSV.

---

> ### Phase 10 — Notebooks
>
> **Paste to Claude Code:**
> ```
> Build the 11 notebooks listed in the repo layout. Each notebook:
> - Has a clear title + abstract markdown cell at the top
> - Sets numpy/torch random seeds to 42
> - Loads data from /data/, /results/, or the DB
> - Produces at least one figure saved to /docs/figures/
> - Ends with a "Findings" markdown cell summarising what the notebook shows
>
> Start with 01_dataset_card.ipynb and 05_baselines.ipynb (these are highest
> value for the reviewer). Stop after these two and let me review before
> building the rest.
> ```
>
> **Acceptance:** Both notebooks run end-to-end (`jupyter nbconvert --execute`) without error and produce the expected figures.

---

> ### Phase 11 — Paper, model card, dataset card
>
> **Paste to Claude Code:**
> ```
> Fill in PAPER.md, MODEL_CARD.md, DATASET_CARD.md per the outlines in
> Part VIII. Pull metric values directly from /results/. Include all figures
> from /docs/figures/. Cite the references for hybrid RAG, Outlines,
> Self-RAG, Qwen2.5-VL, bge embeddings, and Cohen's kappa.
>
> Where a number isn't yet measured, leave a [TODO: measure in notebook XX]
> marker rather than inventing a value.
>
> Stop and report.
> ```
>
> **Acceptance:** Three documents render cleanly in GitHub preview. No invented numbers (only TODOs in spots needing more data).

---

> ### Phase 12 — Deploy + smoke test + release
>
> **Paste to Claude Code:**
> ```
> Final deployment pass.
> 1. `modal deploy inference/app.py` — production deploy.
> 2. Update Vercel project env vars: MODAL_INFERENCE_URL,
>    MODAL_INFERENCE_TOKEN, INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY.
> 3. `vercel --prod` — frontend deploy.
> 4. Run all 24 cases through the live system via eval/run_full.py against
>    production. Confirm metrics match local results within bootstrap CI.
> 5. Tag a v1.0.0 release on git.
> 6. Update README.md "Results" section with the headline accuracy +
>    confidence interval from the production run.
> 7. docker-compose.yml: confirm the local-everything reproduction path
>    still works (Postgres + Ollama-based fallback for offline replication).
> ```
>
> **Acceptance:** Live URL produces analyses end to end. Headline metric on README has a 95% CI attached. `docker compose up` from a fresh clone produces a working local-only system.

---

# PART XI — Acceptance criteria (the final self-check)

Run this checklist before declaring the project "expert-edition complete":

**Architecture**
- [ ] Repo is a monorepo with `/web/`, `/inference/`, `/eval/`, `/notebooks/`
- [ ] Zero references to Gemini / OpenAI / Anthropic anywhere in the runtime code
- [ ] All inference uses open-weight models documented in `MODEL_CARD.md`
- [ ] Six modules are physically separate files in `/inference/modules/`
- [ ] Hybrid retrieval, reranking, query expansion, relevance filter all implemented

**Research**
- [ ] 24 cases with 3-annotator labels and reported Cohen's κ ≥ 0.6
- [ ] All 6 baselines run, results in `/results/`
- [ ] All 5 ablations run, results in `/results/`
- [ ] Every headline number reported with 95% bootstrap CI
- [ ] ECE + reliability diagram in `/docs/figures/`
- [ ] Error taxonomy populated in every per_case.csv with at least 80% non-null

**Documentation**
- [ ] `PAPER.md` complete, no invented numbers
- [ ] `MODEL_CARD.md` follows Mitchell et al. structure
- [ ] `DATASET_CARD.md` follows Gebru et al. structure
- [ ] 11 notebooks present and re-executable via `jupyter nbconvert --execute`
- [ ] `ARCHITECTURE.md` includes the system diagram from Part II §2.1

**Ops**
- [ ] Vercel live URL works
- [ ] Modal app deployed and accepting authenticated POSTs
- [ ] `docker compose up` reproduces a working system locally
- [ ] `.env.example` lists every required env var
- [ ] Inngest dashboard accessible, shows real runs

**Governance**
- [ ] Advisory-only banner present on every page
- [ ] All actions write `AuditLog` rows
- [ ] No real PII in any committed file (only synthetic)

When every box is checked, the repo is something a PhD professor would proudly link to from their course site.

---

# PART XII — The literal first prompt to paste into Claude Code

Open a terminal in the project folder, run `claude`, and paste this:

```
We are revising ReturnGuard AI into an expert-edition, research-grade artifact.
The current repo (a working v1 MVP built against Gemini) is being migrated to
an open-weight stack on Modal + Vercel, with proper research methodology
(baselines, ablations, multi-annotator labels, calibration, error taxonomy).

Step 1: Read CLAUDE.md and RETURNGUARD_EXPERT_EDITION.md end to end. Then read
the existing repo to understand the v1 state — specifically lib/ai/*.ts,
prisma/schema.prisma, evaluation-report.md, and the README.

Step 2: Reply with:
  (a) A 5-bullet summary of the migration scope (what changes, what stays).
  (b) A list of existing files that will be deleted, modified, or kept.
  (c) Any clarifying questions before Phase 1.

Do not write any code in this turn. We will proceed phase by phase per
RETURNGUARD_EXPERT_EDITION.md Part X. Wait for my confirmation after each
phase's verification command before proceeding.
```

That's the entry point. Phase 0 will complete with Claude Code's summary; you confirm or correct; then paste the Phase 1 prompt, and so on through Phase 12.
