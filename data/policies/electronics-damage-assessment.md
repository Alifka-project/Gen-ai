# Electronics & Appliance Damage Assessment Policy

This policy defines the internal procedures for assessing product damage claims and establishes the evidentiary standards that must be met before any replacement, repair, or refund action is authorised.

## §1 — Damage Classification Framework

1.1 All damage claims must be classified into one of the following categories before any remedy decision is taken:

   **Class A — Manufacturing Defect (DOA)**
   Damage or functional failure present at time of delivery that is attributable to a production fault. Indicators include: factory-sealed packaging, defect visible upon first use, error codes consistent with internal component failure, or technician-confirmed hardware fault with no signs of external impact.

   **Class B — Transit / Delivery Damage**
   Physical damage occurring during transportation from warehouse to customer premises. Indicators include: external packaging damage, dents or cracks at points consistent with dropping or crushing, documented at time of delivery or within 48 hours.

   **Class C — Installation Damage**
   Damage caused during or after installation by an unauthorised or unskilled party. This class is **excluded** from replacement eligibility unless the company's own installation service was responsible.

   **Class D — User Misuse / Accidental Damage**
   Damage resulting from improper use, overloading, incorrect voltage, or accidental impact post-delivery. This class is excluded from warranty and return coverage.

   **Class E — Cosmetic / Wear-and-Tear**
   Minor surface scratches, discolouration, or finish degradation not affecting function. Governed by Return Policy §2.3 — generally not eligible for replacement.

## §2 — Evidence Standards by Damage Class

2.1 For **Class A** claims:
   (a) Photographic or video evidence showing the defect is required as initial documentation.
   (b) A technician visit is mandatory to confirm the manufacturing origin of the fault — photographic evidence alone is insufficient per Warranty Policy §3.2(c).
   (c) If the technician confirms DOA status, replacement is authorised under Warranty Policy §3.3.

2.2 For **Class B** (Transit Damage) claims:
   (a) Time-stamped photographs taken at the time of delivery or within 48 hours are required.
   (b) The delivery note must be checked: if signed as "received in good condition", additional corroborating evidence is required (see Return Policy §2.2).
   (c) If evidence is insufficient but the claim is plausible, the case must be escalated to the logistics partner for their delivery records before a final decision.

2.3 For **Class C and D** claims:
   (a) These are excluded from warranty and statutory return entitlement.
   (b) The customer may be offered a paid-repair service at the company's authorised service rate.
   (c) The manager must document the rationale for exclusion in the case audit log.

2.4 For **Class E** claims:
   (a) Minor cosmetic damage is not eligible for replacement if reported more than 14 days after delivery.
   (b) A goodwill cosmetic touch-up may be offered at the store manager's discretion.

## §3 — Image Analysis Standards (AI-Assisted Assessment)

3.1 The ReturnGuard AI system analyses uploaded product images using multimodal AI (Gemini 2.0 Flash) to detect:
   (a) **Visible physical damage**: dents, cracks, scratches, broken parts, liquid damage indicators.
   (b) **Damage type classification**: scratch, dent, broken_part, leakage, packaging_damage, or none_visible.
   (c) **Evidence quality score** (0–100): assesses image clarity, lighting, angle, and completeness.
   (d) **Claim-image consistency**: whether the photographed damage is consistent with the customer's complaint narrative.

3.2 AI image analysis output is **advisory only**. For Class A functional faults, a technician visit remains mandatory regardless of AI output.

3.3 An evidence quality score below 40/100 indicates the uploaded images are insufficient for automated assessment. In this case, the AI will recommend "request_more_evidence" and the case agent should contact the customer for better-quality photographs.

3.4 If no images are attached, the AI will score visual analysis at 0 and will not classify the damage type — all visual factors will be marked as "inconclusive".

## §4 — Serial Number Verification

4.1 The product serial number must be verified against the company's sales records before any warranty claim is processed. If the serial number is not visible in the submitted images, the customer must provide a photograph of the serial number label.

4.2 A product with a tampered, illegible, or removed serial number shall have its warranty voided, unless the customer can provide the original invoice with serial number clearly printed.

4.3 The AI system will flag when the serial number is not visible in the submitted images (visual_analysis.serial_number_visible = false) and will include this in the missing_evidence list.

## §5 — Multi-Incident and Repeat Claims

5.1 A customer submitting a second replacement claim for the same product model within 12 months must be flagged for enhanced review. The Regional Service Manager must approve any second replacement for the same customer-product combination.

5.2 Cases where the same defect recurs after two prior repairs are eligible for replacement, not further repair, in accordance with Warranty Policy §3.3.

5.3 The AI system will retrieve historical case data during the RAG retrieval phase to surface any prior claims for the same customer or product serial number.

## §6 — High-Value Product Escalation

6.1 For products with an invoice value exceeding **AED 5,000**, all replacement decisions require dual authorisation: the Regional Service Manager AND the Finance Controller.

6.2 For products with an invoice value exceeding **AED 10,000**, the case must be documented and approved by the Country Head of After-Sales before the replacement unit is dispatched.

6.3 The AI system will extract the product value from the invoice document (document_analysis.product_value_aed) and flag high-value cases accordingly in the manager_summary.
