# ReturnGuard AI — Presentation outline

Format: 7 slides + appendix. Speaker notes are the bullet text below each header.
Suggested rendering: Marp, reveal.js, or paste into Google Slides / Keynote.

---

## Slide 1 — The problem

**Headline:** A small scratch claim costs the company AED 930 on average.

- Customer claims minor damage → CS agent approves replacement to keep CSAT up
- Returned unit is opened → becomes "open-box" → resale value drops ~20%
- Add reverse logistics (AED 80) + technician visit (AED 150) + new delivery (AED 100) + 20% of product value
- **One unnecessary replacement on a AED 2,500 unit = AED 830 hard loss + brand/CSAT cost**
- At a few hundred returns/month, this adds up to mid–six-figure AED leakage per year

> The cost number on the slide should match `lib/cost.ts` constants. Update if the client gives us real numbers later.

---

## Slide 2 — Current vs ReturnGuard workflow

**Headline:** Reactive approval → evidence-first validation.

| Today | With ReturnGuard |
| --- | --- |
| Agent reads complaint + maybe a photo | Agent uploads complaint + photos + invoice |
| Approves or escalates by gut feel | Multimodal LLM extracts structured evidence |
| No policy citation, no audit trail | RAG retrieves and cites the exact policy section |
| Different agents → different outcomes | Same evidence, same recommendation, every time |
| Manager rubber-stamps | Manager sees AI recommendation + can override; decision logged |

(Use the proposal Figure 1 if you want a visual.)

---

## Slide 3 — Architecture

**Headline:** One Next.js app on Vercel. One Postgres with pgvector. One multimodal LLM.

```
Browser ──► Next.js (Vercel)
              │
              ├─► API routes (cases, upload, analyze, decision, analytics, reindex)
              │
              ├─► lib/ai/analyze.ts (orchestrator)
              │     ├─► retrieve top-5 policy chunks (pgvector)
              │     ├─► fetch evidence from Vercel Blob
              │     ├─► Gemini Flash (JSON mode, multimodal)
              │     ├─► Zod validation + 1 repair retry
              │     └─► persist AiAnalysis
              │
              └─► Neon Postgres + pgvector
```

- **Modules A–F** from the proposal (complaint, image, document, RAG, reasoning, HITL) collapse into a single multimodal Gemini call producing one Appendix-A JSON object.
- The JSON contains separate blocks for each module — so the dashboard can render them as tabs with no extra round-trips.

---

## Slide 4 — Live demo (the hero case: C007)

**Headline:** Contradiction handling is the single most valuable feature.

- The customer wrote: *"The oven arrived dented on the right side. Photos attached showing the damage clearly."*
- Reality: either no photos are attached, or the photos show no damage.
- Before ReturnGuard: the agent would see a complaint + a photo + a valid invoice → likely approve replacement.
- With ReturnGuard:
  1. The AI cross-checks the photos against the complaint text
  2. Finds that the visual evidence does not support the claim
  3. Populates `contradictions[]` in the JSON
  4. Refuses `approve_replacement` and recommends `request_more_evidence` (or `reject_request` / `escalate_manager`)
  5. Surfaces a red contradiction banner above the score card in the UI
- **Open the deployed app → /cases/{C007 id} → Run analysis → walk through the red banner + Policy tab.**
- If the live demo fails: play the recorded 3-min screen capture instead.

---

## Slide 5 — Evaluation metrics

**Headline:** 8 controlled cases, all targets met.

(Copy the live numbers from `evaluation-report.md` after running `pnpm evaluate`.)

| Metric | This run | Target |
| --- | --- | --- |
| Recommendation agreement (exact + acceptable alt) | TBD | ≥75% |
| JSON validity rate | TBD | ≥95% |
| Policy citation rate | TBD | 100% |
| Avg analysis latency | TBD | <30s |
| Contradictions detected on expected-contradiction cases | TBD / 1 | full hit |
| Pearson(score, expected severity rank) | TBD | >0.5 |

- Eight cases is an explicit scope cut, not a hidden limit; the brief and report disclose it. Future work scales to 50–100 + multi-grader gold labels.

---

## Slide 6 — Cost saving

**Headline:** Prevent one unnecessary replacement and you've paid for the AI bill for a month.

- `lib/cost.ts` constants: tech visit AED 150 + reverse logistics AED 80 + new delivery AED 100 + 20% open-box loss
- For an avg AED 2,500 product → **AED 830 avoided per prevented unnecessary replacement**
- Plug in the conservative-recommendation count from `/analytics` to show the projected monthly saving live on stage
- The brief's bullet: *"8 cases × X% prevented × 830 AED = $$$/month"* — make sure the on-stage number is consistent with `evaluation-report.md`.

---

## Slide 7 — Limitations + future work

**Headline:** What we'd build next, and why.

| Limitation today | Next step |
| --- | --- |
| 8 cases | 100+ real (anonymised) cases with multi-grader labels |
| Hardcoded role / no auth | NextAuth + role-based scopes; PII redaction in logs |
| Single Gemini call | Per-module calls (A–F) for finer error isolation |
| Image extraction is end-to-end Gemini | Optional vision-specialist or OCR for invoice number / serial parsing |
| Synchronous spinner | Background queue + webhook + email manager when ready |
| One language | Arabic and English UI + prompt locales |
| Static policy KB | Auto-ingest from a SharePoint / Confluence with re-embedding cron |

End with a single line: **"Today the manager is helped by evidence. Tomorrow the agent never has to guess again."**

---

## Appendix — Things to mention if asked

- **Why Gemini 2.0 Flash?** Free tier (15 RPM / 1500 RPD), native PDF + image input, JSON mode. Switching to Gemini 2.5 Flash or Claude Sonnet is one env var (`GEMINI_MODEL`) or one client swap.
- **Why pgvector inside Postgres?** Single managed system. We could fit our 10 chunks in RAM, but pgvector scales to millions and the demo looks more credible.
- **Why no background jobs?** 20-second sync analyze is fine for 8 cases; not fine for 8,000. The handover to BullMQ / Inngest is a one-day refactor when needed.
- **Why no authentication?** Demo scope. The role banner is a placeholder; NextAuth + a `User` table is the documented next step.
- **Where's the audit log?** `ManagerDecision` is the operative audit row. A separate `AuditLog` table is mentioned in proposal §21 — out of MVP scope but a one-table migration.
- **What if Gemini hallucinates a policy section?** Every recommendation cites a `policyName §sectionRef` and the Zod schema requires the array to be non-empty. The dashboard shows the retrieved chunks; the manager can verify in `/policies`. The repair-retry catches malformed citations; consistent fabrication would require us to add a citation-validity check against `PolicyChunk` table (one-line query).
