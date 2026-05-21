# Project memory for Claude Code — ReturnGuard AI (Expert Edition)

## What you are building

A **PhD-grade, research-quality, reproducible** Multimodal RAG + Human-in-the-Loop decision-support system for product return validation. The output is both (a) a working web demo and (b) a research artifact: paper-style writeup, model card, dataset card, baselines, ablations, and notebooks. It is **intended for public release and use in graduate-level teaching**.

## Read these files at the start of every session
1. `RETURNGUARD_EXPERT_EDITION.md` — the authoritative build spec. Supersedes `RETURNGUARD_BUILD_BRIEF.md` (the older v1 spec, retained for history but not the target).
2. `Project Proposal Advanced Multi-modal Decision Support Customer Complaint.pdf` — the original academic proposal that the project must cover.

## What changed vs the old v1 build
- **No commercial closed-model APIs.** Gemini is out. All inference uses open-weight models (Qwen2.5-VL-7B, bge-large-en-v1.5, bge-reranker-v2-m3, PaddleOCR) deployed on **Modal** (serverless GPU). The `web/` tier still deploys to Vercel.
- **Architecture is now split**: thin web tier on Vercel + Python inference tier on Modal, communicating via async jobs (Inngest).
- **The six proposal modules are now genuinely decoupled** in code (`/inference/modules/{vision,ocr,rag,reasoner,critic}.py`). Each is independently swappable, benchmarkable, and ablatable.
- **Research methodology is now first-class**: baselines, ablations, bootstrap CIs, multi-annotator labels with Cohen's kappa, calibration analysis, error taxonomy, per-stage latency profiling.
- **Repo deliverables expand**: Jupyter notebooks (research narrative), `PAPER.md`, `MODEL_CARD.md`, `DATASET_CARD.md`, `ARCHITECTURE.md`, `EVALUATION.md`, `docker-compose.yml` for fully local reproduction.

## Locked stack — do not change without team consensus

**Web tier (Vercel):**
- Next.js 14 App Router + TypeScript
- Neon Postgres + pgvector (via Prisma)
- Vercel Blob (image / PDF storage)
- Inngest (durable async jobs)
- shadcn/ui + Tailwind + recharts + lucide-react
- Zod for client-side type safety

**Inference tier (Modal):**
- Modal (serverless GPU; A10G default, A100 if budget allows)
- vLLM as LLM/VLM runtime (high throughput, batching)
- Qwen2.5-VL-7B-Instruct (multimodal reasoning, vision + text)
- bge-large-en-v1.5 (1024-dim embeddings, sentence-transformers)
- bge-reranker-v2-m3 (cross-encoder reranking, FlagEmbedding)
- PaddleOCR PP-OCRv4 (deterministic document extraction)
- Outlines (grammar-constrained JSON decoding — guarantees schema validity)
- Pydantic for inference-side validation

**Research / eval (Python):**
- Jupyter, pandas, numpy, scipy.stats, scikit-learn
- matplotlib + seaborn for figures
- Weights & Biases (optional) or local JSON experiment logs

## Operating rules
- Inference logic lives in `/inference/`. The Next.js `/lib/ai/` directory is now a **thin client** that calls Modal endpoints — never a place for prompts, model calls, or reasoning logic.
- Every prompt must be versioned under `/inference/prompts/vN/`. Bumping a prompt requires updating `/inference/prompts/CHANGELOG.md`.
- Every experiment run writes to `/results/YYYY-MM-DD_<experiment_name>/` with per-case CSV + aggregate metrics JSON + figures.
- Metrics reported in the paper or README must always include 95% bootstrap CIs. No bare percentages on n<30.
- Failures are categorized via the error taxonomy in `EVALUATION.md` §Error Modes. Every red-team / eval failure must land in this taxonomy.
- AI output is **advisory only**. The persistent banner stays. Final decision belongs to the manager. This is non-negotiable.
- Stop after each phase in `RETURNGUARD_EXPERT_EDITION.md` Part X (Claude Code Execution Plan) and run the verification command. Do not proceed without user confirmation.
- When unsure about policy semantics, scoring weights, or label disagreements: **ask**. Do not silently choose.

## Standard commands

**Web tier:**
```bash
pnpm dev                                    # Local Next.js dev
pnpm prisma migrate dev                     # Apply schema migration
pnpm prisma studio                          # DB inspector
pnpm tsx scripts/seed.ts                    # Seed demo cases
pnpm lint && pnpm tsc --noEmit              # Pre-commit checks
```

**Inference tier:**
```bash
cd inference
uv sync                                     # Install Python deps
modal serve app.py                          # Local dev against Modal
modal deploy app.py                         # Deploy to production
modal run app.py::healthcheck               # Smoke test
```

**Research tier:**
```bash
cd eval
uv run python run_baselines.py              # Run all 6 baselines
uv run python run_ablations.py              # Run ablation matrix
uv run jupyter lab                          # Open notebooks
```

## Coding conventions

**TypeScript (web/):**
- Server Components by default; `"use client"` only for stateful UI
- API route handlers return `NextResponse.json(...)` with explicit status codes
- Prisma client from `@/lib/db/prisma` (singleton)
- Inference calls go through `@/lib/inference-client.ts`
- Inngest functions in `@/lib/jobs/`

**Python (inference/, eval/):**
- Python 3.11+, `uv` for dep management, `pyproject.toml`
- Strict typing via Pydantic + mypy
- Every module exposes a typed `run(input: InputSchema) -> OutputSchema` function
- Logging via `structlog`, JSON output for machine parsing
- Random seeds: `numpy.random.seed(42)`, `torch.manual_seed(42)` in every notebook

## Strings shown to the manager
Must be non-blaming, evidence-first, and cite policy section references. No customer-blaming language. No marketing language. See `RETURNGUARD_EXPERT_EDITION.md` §6 for the master prompt rules.

## Team
- **Alif** — AI pipeline owner (`/inference/`, prompts, evaluation, paper writeup)
- **Shahansha** — Web tier owner (Next.js, Prisma, Inngest jobs, deployment)
- **Vishal** — Dashboard + research notebook author (`/notebooks/`, figures, demo)

## When in doubt
Re-read `RETURNGUARD_EXPERT_EDITION.md` Part IX (Proposal Coverage Matrix v2) to confirm whether what you're building is in scope.
