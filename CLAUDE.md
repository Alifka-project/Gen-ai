# Project memory for Claude Code

You are helping build **ReturnGuard AI** — a Multimodal RAG + Human-in-the-Loop decision support system for product return validation. This is a 2-day MVP for a Master's GenAI final project that will be handed to a real client.

## Always read these two files at the start of every session
1. `RETURNGUARD_BUILD_BRIEF.md` — the full build spec (architecture, schema, prompts, plan)
2. `Project Proposal Advanced Multi-modal Decision Support Customer Complaint.pdf` — the original academic proposal (the brief compresses this; when they disagree, the brief wins)

## Locked stack — do not change
- Next.js 14 App Router + TypeScript
- Vercel hosting + Vercel Blob storage
- Neon Postgres + pgvector
- Prisma ORM
- Google Gemini 2.0 Flash (multimodal, JSON mode) + text-embedding-004
- shadcn/ui + Tailwind + lucide-react + recharts
- Zod for LLM output validation
- Package manager: pnpm

## Operating rules
- Read the brief section BEFORE writing code for that section. The brief contains the exact Prisma schema, prompts, API contracts, and acceptance criteria.
- Validate every Gemini output with Zod before saving to DB. Retry once on invalid JSON.
- AI output is **advisory only**. The UI must always show the "AI output is advisory. Final decision belongs to the authorized manager." banner.
- Use environment variables for all secrets. Never commit `.env*` files.
- After each phase in `RETURNGUARD_BUILD_BRIEF.md` Part II Section 28, run the verification command and STOP. Wait for the user to confirm before proceeding to the next phase.
- When unsure, ask clarifying questions rather than guess. Especially around: business policy rules, edge-case recommendations, and UI copy that the manager will see.

## Standard commands
```bash
pnpm dev                       # local dev server
pnpm prisma migrate dev        # apply schema changes
pnpm prisma studio             # inspect DB
pnpm tsx scripts/index-policies.ts   # rebuild policy embeddings
pnpm tsx scripts/run-evaluation.ts   # run all 8 demo cases + metrics
pnpm lint && pnpm tsc --noEmit       # before commit
```

## Coding conventions
- Server Components by default; mark Client Components with `"use client"` only where state/effects are needed.
- API route handlers return `NextResponse.json(...)` with explicit status codes.
- Prisma client imported from `@/lib/db/prisma` (singleton).
- Gemini client + prompts live in `@/lib/ai/`.
- Zod schemas live next to the code that uses them.
- Strings shown to the manager must be non-blaming and evidence-first (see brief §18).

## Team
- **Alif** — AI pipeline owner (`lib/ai/`, prompts, evaluation, final report)
- **Shahansha** — Backend owner (API routes, Prisma, deployment)
- **Vishal** — Frontend owner (pages, dashboard, dataset, slides)

## When in doubt
Re-read `RETURNGUARD_BUILD_BRIEF.md` Part II Section 17 (the Proposal Coverage Matrix) to confirm whether what you're building is in scope for the 2-day MVP.
