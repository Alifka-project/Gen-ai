# ReturnGuard AI — Evaluation Report

_Generated 2026-05-16T14:36:26.303Z · model: `gemini-2.5-flash` · embedding: `gemini-embedding-001`._

## Aggregate metrics

| Metric | Value | Target |
| --- | ---: | ---: |
| Recommendation agreement (exact + acceptable alternative) | **100.0%** (8/8) | ≥75% |
| JSON validity rate | **100.0%** (8/8) | ≥95% |
| Policy citation rate | **100.0%** (8/8) | 100% |
| Avg analysis latency | **15078 ms** | <30000 |
| Contradictions detected on cases that expect one | **0/1** | full hit |
| Pearson(score, expected severity rank) | **0.616** | >0.5 |

## Per-case results

| Case | Expected | Got | Match | Score | RVS recomp | Δ | Citations | Contradictions | Latency |
| --- | --- | --- | :-: | ---: | ---: | ---: | ---: | ---: | ---: |
| demo-c001 | remote_troubleshooting | send_technician | ≈ | 0 | 38 | 38 | 6 | 1 | 17920ms |
| demo-c002 | approve_replacement | request_more_evidence | ≈ | 0 | 36 | 36 | 2 | 0 | 12309ms |
| demo-c003 | reject_request | reject_request | ✓ | 0 | 29 | 29 | 4 | 0 | 9306ms |
| demo-c004 | request_more_evidence | request_more_evidence | ✓ | 0 | 31 | 31 | 2 | 0 | 12189ms |
| demo-c005 | request_more_evidence | request_more_evidence | ✓ | 0 | 33 | 33 | 6 | 0 | 13088ms |
| demo-c006 | remote_troubleshooting | send_technician | ≈ | 0 | 51 | 51 | 6 | 1 | 14256ms |
| demo-c007 | request_more_evidence | request_more_evidence | ✓ | 0 | 32 | 32 | 2 | 0 | 13021ms |
| demo-c008 | approve_replacement | request_more_evidence | ≈ | 20 | 30 | 10 | 1 | 0 | 28537ms |

## Cost-saving estimate

On this 8-case run, the AI recommended a conservative path (reject / request evidence / remote troubleshoot / technician / escalate) 8 time(s).

- Estimated cost avoided on this batch (avg product value AED 2500): **AED 6,640**
- Projected monthly saving at 4× this volume: **AED 26,560**

## Successes (selected)

### demo-c001 — Bosch WNA264U9ID washer-dryer — drying cycle does not heat

- **Expected:** `remote_troubleshooting`
- **Got:** `send_technician` (alternative)
- **Manager summary:** Customer reports a functional defect with the drying cycle of their 8-month-old Bosch washer-dryer, specifically a lack of heating. As per policy, functional heating complaints cannot be approved for direct replacement without a technician's diagnosis. The unit appears to be within the 12-month warranty period. Recommend dispatching an authorized technician to diagnose the fault.
- **Contradictions flagged:** `The customer requested a 'replacement', but policy states that functional heating complaints cannot be approved for direct replacement on first contact and require a technician's diagnosis.`

### demo-c002 — Bosch WGG444E0ID 9 kg washer — torn door gasket at delivery

- **Expected:** `approve_replacement`
- **Got:** `request_more_evidence` (alternative)
- **Manager summary:** The customer claims a 5-cm tear on the door rubber gasket of a newly delivered washer, stating photos were taken during unboxing. However, no photographic evidence was provided for review. To validate this claim of visible physical damage on arrival, clear photos of the alleged damage are required as per Return Policy §2.1 and §3.2(a).

### demo-c003 — Samsung WW91K54E0UX/TL AddWash 9 kg — cosmetic scratch after 25 days

- **Expected:** `reject_request`
- **Got:** `reject_request` (exact)
- **Manager summary:** The customer reported a minor cosmetic scratch 25 days post-delivery. Per policy, minor cosmetic scratches reported more than 14 days after delivery are not eligible for replacement. Recommend rejecting the replacement request.

## Method

Each case in `data/demo-cases/c00*/` defines an `expected.json` with the gold-label recommendation and acceptable alternatives. `scripts/run-evaluation.ts` loads each fixture, finds the matching seeded `Case` row, calls `analyzeCase()` (the same orchestrator used by the API), and records latency + recommendation + contradictions + citations. Aggregates are computed as documented in proposal §19 / brief §23. RVS is recomputed locally with `lib/ai/score.ts` and the absolute delta is reported; a delta > 20 is logged on the dashboard as a sanity-check warning.

## Limitations

- **Sample size.** Eight cases vs the proposal's 50–100 — explicit scope cut for the 2-day MVP. Future work scales the dataset and adds inter-annotator agreement among multiple managers.
- **Synthetic data.** Cases, photos, and invoices are synthetic per proposal §13.3. Production evaluation requires anonymised real-world cases under privacy review.
- **Single grader.** "Expected" labels are the build-team's interpretation of the policy text; a real client-side gold set would require the client's service-ops team to label.
- **No image uploads in seed.** Cases C002 and C007 are best demonstrated with attached photos (broken-door image / no-damage image). Run the analysis after attaching images via the UI for the most accurate visual_analysis output.
