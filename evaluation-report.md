# ReturnGuard AI — Evaluation Report

_Generated 2026-05-21T19:50:37.574Z · model: `gpt-4o` · embedding: `text-embedding-3-small`._

## Aggregate metrics

| Metric | Value | Target |
| --- | ---: | ---: |
| Recommendation agreement (exact + acceptable alternative) | **100.0%** (8/8) | ≥75% |
| JSON validity rate | **100.0%** (8/8) | ≥95% |
| Policy citation rate | **100.0%** (8/8) | 100% |
| Avg analysis latency | **26377 ms** | <30000 |
| Contradictions detected on cases that expect one | **1/1** | full hit |
| Pearson(score, expected severity rank) | **0.143** | >0.5 |

## Per-case results

| Case | Expected | Got | Match | Score | RVS recomp | Δ | Citations | Contradictions | Latency |
| --- | --- | --- | :-: | ---: | ---: | ---: | ---: | ---: | ---: |
| demo-c001 | remote_troubleshooting | send_technician | ≈ | 30 | 46 | 16 | 2 | 0 | 26618ms |
| demo-c002 | approve_replacement | request_more_evidence | ≈ | 20 | 44 | 24 | 2 | 1 | 24784ms |
| demo-c003 | reject_request | reject_request | ✓ | 20 | 44 | 24 | 2 | 1 | 23933ms |
| demo-c004 | request_more_evidence | request_more_evidence | ✓ | 30 | 46 | 16 | 2 | 0 | 28170ms |
| demo-c005 | request_more_evidence | request_more_evidence | ✓ | 25 | 34 | 9 | 2 | 0 | 29595ms |
| demo-c006 | remote_troubleshooting | send_technician | ≈ | 30 | 44 | 14 | 2 | 0 | 26522ms |
| demo-c007 | request_more_evidence | request_more_evidence | ✓ | 20 | 44 | 24 | 2 | 1 | 27000ms |
| demo-c008 | approve_replacement | request_more_evidence | ≈ | 30 | 45 | 15 | 1 | 1 | 24396ms |

## Cost-saving estimate

On this 8-case run, the AI recommended a conservative path (reject / request evidence / remote troubleshoot / technician / escalate) 8 time(s).

- Estimated cost avoided on this batch (avg product value AED 2500): **AED 6,640**
- Projected monthly saving at 4× this volume: **AED 26,560**

## Successes (selected)

### demo-c001 — Bosch WNA264U9ID washer-dryer — drying cycle does not heat

- **Expected:** `remote_troubleshooting`
- **Got:** `send_technician` (alternative)
- **Manager summary:** The case involves a functional issue with the drying cycle of a Bosch washer-dryer. No images or documents were provided to verify the claim. As per policy, a technician should be dispatched to diagnose the issue before considering replacement.

### demo-c002 — Bosch WGG444E0ID 9 kg washer — torn door gasket at delivery

- **Expected:** `approve_replacement`
- **Got:** `request_more_evidence` (alternative)
- **Manager summary:** Request the customer to provide photographic evidence of the reported damage and any delivery documentation to proceed with the claim evaluation.
- **Contradictions flagged:** `Customer claims photos were attached, but no images were provided.`

### demo-c003 — Samsung WW91K54E0UX/TL AddWash 9 kg — cosmetic scratch after 25 days

- **Expected:** `reject_request`
- **Got:** `reject_request` (exact)
- **Manager summary:** The request for replacement due to a cosmetic scratch reported 25 days after delivery should be rejected as per policy. Offer a goodwill cosmetic touch-up if deemed appropriate.
- **Contradictions flagged:** `Customer claims a scratch but no photographic evidence was provided.`

## Method

Each case in `data/demo-cases/c00*/` defines an `expected.json` with the gold-label recommendation and acceptable alternatives. `scripts/run-evaluation.ts` loads each fixture, finds the matching seeded `Case` row, calls `analyzeCase()` (the same orchestrator used by the API), and records latency + recommendation + contradictions + citations. Aggregates are computed as documented in proposal §19 / brief §23. RVS is recomputed locally with `lib/ai/score.ts` and the absolute delta is reported; a delta > 20 is logged on the dashboard as a sanity-check warning.

## Limitations

- **Sample size.** Eight cases vs the proposal's 50–100 — explicit scope cut for the 2-day MVP. Future work scales the dataset and adds inter-annotator agreement among multiple managers.
- **Synthetic data.** Cases, photos, and invoices are synthetic per proposal §13.3. Production evaluation requires anonymised real-world cases under privacy review.
- **Single grader.** "Expected" labels are the build-team's interpretation of the policy text; a real client-side gold set would require the client's service-ops team to label.
- **No image uploads in seed.** Cases C002 and C007 are best demonstrated with attached photos (broken-door image / no-damage image). Run the analysis after attaching images via the UI for the most accurate visual_analysis output.
