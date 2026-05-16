# ReturnGuard AI — Evaluation Report

_Generated 2026-05-16T14:03:59.613Z · model: `gemini-flash-latest` · embedding: `gemini-embedding-001`._

## Aggregate metrics

| Metric | Value | Target |
| --- | ---: | ---: |
| Recommendation agreement (exact + acceptable alternative) | **75.0%** (6/8) | ≥75% |
| JSON validity rate | **100.0%** (8/8) | ≥95% |
| Policy citation rate | **100.0%** (8/8) | 100% |
| Avg analysis latency | **15007 ms** | <30000 |
| Contradictions detected on cases that expect one | **1/1** | full hit |
| Pearson(score, expected severity rank) | **0.886** | >0.5 |

## Per-case results

| Case | Expected | Got | Match | Score | RVS recomp | Δ | Citations | Contradictions | Latency |
| --- | --- | --- | :-: | ---: | ---: | ---: | ---: | ---: | ---: |
| demo-c001 | remote_troubleshooting | send_technician | ≈ | 0 | 36 | 36 | 3 | 0 | 10696ms |
| demo-c002 | approve_replacement | request_more_evidence | ✗ | 50 | 37 | 13 | 3 | 0 | 28850ms |
| demo-c003 | reject_request | reject_request | ✓ | 0 | 27 | 27 | 3 | 0 | 11439ms |
| demo-c004 | request_more_evidence | request_more_evidence | ✓ | 0 | 31 | 31 | 2 | 1 | 9854ms |
| demo-c005 | request_more_evidence | request_more_evidence | ✓ | 0 | 32 | 32 | 3 | 0 | 9546ms |
| demo-c006 | remote_troubleshooting | send_technician | ≈ | 0 | 36 | 36 | 3 | 0 | 9870ms |
| demo-c007 | request_more_evidence | request_more_evidence | ✓ | 20 | 31 | 11 | 2 | 1 | 26976ms |
| demo-c008 | approve_replacement | request_more_evidence | ✗ | 50 | 36 | 14 | 2 | 0 | 12825ms |

## Cost-saving estimate

On this 8-case run, the AI recommended a conservative path (reject / request evidence / remote troubleshoot / technician / escalate) 8 time(s).

- Estimated cost avoided on this batch (avg product value AED 2500): **AED 6,640**
- Projected monthly saving at 4× this volume: **AED 26,560**

## Successes (selected)

### demo-c001 — Refrigerator not cooling

- **Expected:** `remote_troubleshooting`
- **Got:** `send_technician` (alternative)
- **Manager summary:** The customer is reporting a functional cooling failure on a unit that is 8 months old. Per company policy, cooling issues require a technician's authoritative diagnosis. Replacement is currently ineligible as the fault must first be verified and repair must be attempted or deemed non-viable by an authorized technician.

### demo-c003 — Minor scratch found after 20 days

- **Expected:** `reject_request`
- **Got:** `reject_request` (exact)
- **Manager summary:** The replacement request should be rejected. According to Return Policy §2.3, minor cosmetic scratches reported more than 14 days after delivery are not eligible for replacement. Furthermore, Return Policy §2.1 requires visible damage to be reported within 48 hours of delivery. As the customer reported this 20 days post-delivery, the claim falls outside the eligibility window. A goodwill cosmetic touch-up may be offered at the store's discretion.

### demo-c004 — Missing accessory in box

- **Expected:** `request_more_evidence`
- **Got:** `request_more_evidence` (exact)
- **Manager summary:** The customer is requesting a unit replacement for a missing turntable. Per Replacement Policy §3.3, missing accessories are resolved via part dispatch, not unit replacement. As no photos or proof of purchase were provided, we must request photographic evidence of the unboxed microwave and the invoice before proceeding with an accessory dispatch.
- **Contradictions flagged:** `The customer is requesting a full unit replacement for a missing accessory, which is not the standard remedy under Replacement Policy §3.3.`

## Failures (root-cause notes)

### demo-c002 — Washer delivered with broken door

- **Expected:** `approve_replacement` (alternatives: `escalate_manager`)
- **Got:** `request_more_evidence`
- **Possible cause:** Clear physical damage, fresh delivery (within return window). Eligible for direct replacement per Replacement Policy §1 if evidence is documented per Return Policy §2.

### demo-c008 — Wrong model delivered

- **Expected:** `approve_replacement` (alternatives: `escalate_manager`)
- **Got:** `request_more_evidence`
- **Possible cause:** Wrong-model-delivered cases are eligible for direct replacement per Replacement Policy §1.3 regardless of the return window. The serial label on the unit not matching the invoice product family is the operative evidence.

## Method

Each case in `data/demo-cases/c00*/` defines an `expected.json` with the gold-label recommendation and acceptable alternatives. `scripts/run-evaluation.ts` loads each fixture, finds the matching seeded `Case` row, calls `analyzeCase()` (the same orchestrator used by the API), and records latency + recommendation + contradictions + citations. Aggregates are computed as documented in proposal §19 / brief §23. RVS is recomputed locally with `lib/ai/score.ts` and the absolute delta is reported; a delta > 20 is logged on the dashboard as a sanity-check warning.

## Limitations

- **Sample size.** Eight cases vs the proposal's 50–100 — explicit scope cut for the 2-day MVP. Future work scales the dataset and adds inter-annotator agreement among multiple managers.
- **Synthetic data.** Cases, photos, and invoices are synthetic per proposal §13.3. Production evaluation requires anonymised real-world cases under privacy review.
- **Single grader.** "Expected" labels are the build-team's interpretation of the policy text; a real client-side gold set would require the client's service-ops team to label.
- **No image uploads in seed.** Cases C002 and C007 are best demonstrated with attached photos (broken-door image / no-damage image). Run the analysis after attaching images via the UI for the most accurate visual_analysis output.
