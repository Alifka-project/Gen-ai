import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { computeRVS } from "@/lib/ai/score";
import { aiAnalysisSchema } from "@/lib/ai/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [analyses, policyChunks] = await Promise.all([
      prisma.aiAnalysis.findMany({
        include: {
          case: {
            select: {
              id: true,
              customerName: true,
              productModel: true,
              serialNumber: true,
              complaintText: true,
              requestedAction: true,
              createdAt: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.policyChunk.count(),
    ]);

    if (analyses.length === 0) {
      return NextResponse.json({
        totalAnalyses: 0,
        avgLatencyMs: 0,
        avgScore: 0,
        minScore: 0,
        maxScore: 0,
        recommendationCounts: {},
        scoreDistribution: [],
        caseDetails: [],
        policyChunkCount: policyChunks,
        modelsUsed: [],
        avgRetrievedChunks: 0,
        avgChunkSimilarity: 0,
        rvsAccuracy: 0,
      });
    }

    let totalLatency = 0;
    let totalScore = 0;
    let minScore = 100;
    let maxScore = 0;
    const recommendationCounts: Record<string, number> = {};
    const modelsUsedSet = new Set<string>();
    let totalChunksRetrieved = 0;
    let totalChunkSimilarity = 0;
    let chunkCount = 0;
    let rvsMatchCount = 0;

    // Score distribution buckets: 0-20, 21-40, 41-60, 61-80, 81-100
    const scoreDistributionMap: Record<string, number> = {
      "0–20": 0,
      "21–40": 0,
      "41–60": 0,
      "61–80": 0,
      "81–100": 0,
    };

    const caseDetails = analyses.map((a) => {
      totalLatency += a.latencyMs;
      totalScore += a.replacementValidityScore;
      minScore = Math.min(minScore, a.replacementValidityScore);
      maxScore = Math.max(maxScore, a.replacementValidityScore);
      recommendationCounts[a.recommendation] =
        (recommendationCounts[a.recommendation] ?? 0) + 1;
      modelsUsedSet.add(a.modelUsed);

      // Score distribution
      if (a.replacementValidityScore <= 20) scoreDistributionMap["0–20"]++;
      else if (a.replacementValidityScore <= 40) scoreDistributionMap["21–40"]++;
      else if (a.replacementValidityScore <= 60) scoreDistributionMap["41–60"]++;
      else if (a.replacementValidityScore <= 80) scoreDistributionMap["61–80"]++;
      else scoreDistributionMap["81–100"]++;

      // Retrieved chunks stats
      const chunks = (a.retrievedChunks as Array<{
        id: string;
        policyName: string;
        sectionRef: string;
        score: number;
      }> | null) ?? [];
      totalChunksRetrieved += chunks.length;
      for (const c of chunks) {
        totalChunkSimilarity += c.score;
        chunkCount++;
      }

      // RVS drift check
      const parsed = aiAnalysisSchema.safeParse(a.explanationJson);
      const computed = parsed.success ? computeRVS(parsed.data) : null;
      const drift = computed !== null ? Math.abs(computed - a.replacementValidityScore) : null;
      if (drift !== null && drift <= 20) rvsMatchCount++;

      // Factor scores from explanationJson
      let clarityScore: number | null = null;
      let evidenceQuality: number | null = null;
      let visibleDamage: boolean | null = null;
      let damageType: string | null = null;
      let complaintCategory: string | null = null;
      let severity: string | null = null;
      let managerSummary: string | null = null;
      let verifiedFactsCount = 0;
      let uncertaintiesCount = 0;
      let contradictionsCount = 0;
      let invoiceValid: boolean | null = null;
      let warrantyStatus: string | null = null;

      // Evidence provenance (added by the anti-hallucination layer)
      let evidenceInspected: {
        imageCount: number;
        pdfCount: number;
        pdfPagesRead: number;
        pdfCharsExtracted: number;
        scannedPdfCount: number;
        policyChunksRetrieved: number;
        guardEvents: Array<{
          field: string;
          original: unknown;
          enforced: unknown;
          reason: string;
        }>;
      } | null = null;
      // Multi-model ensemble (Claude + GPT + critic)
      let multiModel: {
        primary_model: string;
        secondary_model: string;
        secondary_recommendation: string;
        secondary_score: number;
        secondary_summary: string;
        consensus: {
          actionsMatch: boolean;
          scoreDelta: number;
          level: string;
          resolution: string;
          summary: string;
          matchPct: number;
        };
        critic?: {
          agrees_with_primary: boolean;
          confidence: number;
          disputed_fields: string[];
          critique: string;
          alternate_recommendation: string | null;
          model_used: string;
        };
      } | null = null;
      let damageRegions: Array<{
        region: string;
        description: string;
        severity: string;
        visible_in_images: number[];
      }> = [];
      // Identity verification (from the deterministic identity-verifier)
      let identityVerification: {
        form_serial: string | null;
        invoice_serial: string | null;
        photo_serial: string | null;
        serial_match: string;
        serial_sources_count: number;
        identity_verified: boolean;
        identity_issues: string[];
        identity_score: number;
        product_match: {
          expected_brand: string;
          expected_type: string;
          expected_capacity_kg: string;
          observed_brand: string | null;
          observed_type: string | null;
          observed_capacity_kg: string | null;
          brand_matches: boolean;
          type_matches: boolean;
          capacity_matches: boolean;
          overall_match: boolean;
        };
        customer_name_match: {
          form_name: string;
          invoice_name: string | null;
          matches: boolean;
          similarity: number;
        };
        exif: {
          taken_at: string | null;
          gps_lat: number | null;
          gps_lon: number | null;
          camera: string | null;
        } | null;
      } | null = null;

      if (parsed.success) {
        const d = parsed.data;
        clarityScore = d.complaint_analysis.clarity_score;
        evidenceQuality = d.visual_analysis.evidence_quality_score;
        visibleDamage = d.visual_analysis.visible_damage;
        damageType = d.visual_analysis.damage_type;
        complaintCategory = d.complaint_analysis.category;
        severity = d.complaint_analysis.severity;
        managerSummary = d.manager_summary;
        verifiedFactsCount = d.verified_facts.length;
        uncertaintiesCount = d.uncertainties.length;
        contradictionsCount = d.contradictions.length;
        invoiceValid = d.document_analysis.invoice_valid;
        warrantyStatus = d.document_analysis.warranty_status;
        if (d.evidence_inspected) {
          evidenceInspected = {
            imageCount: d.evidence_inspected.imageCount,
            pdfCount: d.evidence_inspected.pdfCount,
            pdfPagesRead: d.evidence_inspected.pdfPagesRead,
            pdfCharsExtracted: d.evidence_inspected.pdfCharsExtracted,
            scannedPdfCount: d.evidence_inspected.scannedPdfCount,
            policyChunksRetrieved: d.evidence_inspected.policyChunksRetrieved,
            guardEvents: d.evidence_inspected.guardEvents ?? [],
          };
        }
        if (d.multi_model) {
          multiModel = {
            primary_model: d.multi_model.primary_model,
            secondary_model: d.multi_model.secondary_model,
            secondary_recommendation: d.multi_model.secondary_recommendation,
            secondary_score: d.multi_model.secondary_score,
            secondary_summary: d.multi_model.secondary_summary,
            consensus: d.multi_model.consensus,
            critic: d.multi_model.critic,
          };
        }
        damageRegions = d.visual_analysis.damage_regions ?? [];
        if (d.identity_verification) {
          identityVerification = {
            form_serial: d.identity_verification.form_serial,
            invoice_serial: d.identity_verification.invoice_serial,
            photo_serial: d.identity_verification.photo_serial,
            serial_match: d.identity_verification.serial_match,
            serial_sources_count: d.identity_verification.serial_sources_count,
            identity_verified: d.identity_verification.identity_verified,
            identity_issues: d.identity_verification.identity_issues,
            identity_score: d.identity_verification.identity_score,
            product_match: d.identity_verification.product_match,
            customer_name_match: d.identity_verification.customer_name_match,
            exif: d.identity_verification.exif,
          };
        }
      }

      return {
        caseId: a.case?.id ?? a.caseId,
        customerName: a.case?.customerName ?? "Unknown",
        productModel: a.case?.productModel ?? "Unknown",
        serialNumber: a.case?.serialNumber ?? null,
        complaintText: (a.case?.complaintText ?? "").slice(0, 120),
        requestedAction: a.case?.requestedAction ?? "Unknown",
        status: a.case?.status ?? "unknown",
        latencyMs: a.latencyMs,
        score: a.replacementValidityScore,
        recommendation: a.recommendation,
        modelUsed: a.modelUsed,
        retrievedChunks: chunks,
        createdAt: a.createdAt.toISOString(),
        rvsComputed: computed,
        rvsDrift: drift,
        clarityScore,
        evidenceQuality,
        visibleDamage,
        damageType,
        complaintCategory,
        severity,
        managerSummary,
        verifiedFactsCount,
        uncertaintiesCount,
        contradictionsCount,
        invoiceValid,
        warrantyStatus,
        evidenceInspected,
        multiModel,
        damageRegions,
        identityVerification,
      };
    });

    // ── Aggregate multi-model + damage region metrics ──
    let consensusHigh = 0;
    let consensusMedium = 0;
    let consensusLow = 0;
    let actionsMatch = 0;
    let criticAgree = 0;
    let criticDispute = 0;
    let totalCriticConfidence = 0;
    let criticCount = 0;
    let multiModelCases = 0;
    let totalDamageRegions = 0;
    let casesWithDamageRegions = 0;
    for (const cd of caseDetails) {
      if (cd.multiModel) {
        multiModelCases++;
        const lvl = cd.multiModel.consensus.level;
        if (lvl === "high") consensusHigh++;
        else if (lvl === "medium") consensusMedium++;
        else consensusLow++;
        if (cd.multiModel.consensus.actionsMatch) actionsMatch++;
        if (cd.multiModel.critic) {
          criticCount++;
          totalCriticConfidence += cd.multiModel.critic.confidence;
          if (cd.multiModel.critic.agrees_with_primary) criticAgree++;
          else criticDispute++;
        }
      }
      if (cd.damageRegions.length > 0) {
        casesWithDamageRegions++;
        totalDamageRegions += cd.damageRegions.length;
      }
    }
    const avgCriticConfidence = criticCount > 0 ? Math.round(totalCriticConfidence / criticCount) : 0;

    // ── Identity verification aggregates ──
    let identityVerified = 0;
    let identityUnverified = 0;
    let identityInsufficient = 0;
    let serialMatchCount = 0;
    let serialMismatchCount = 0;
    let serialPartialCount = 0;
    let totalIdentityScore = 0;
    let identityCasesCount = 0;
    for (const cd of caseDetails) {
      if (cd.identityVerification) {
        identityCasesCount++;
        totalIdentityScore += cd.identityVerification.identity_score;
        if (cd.identityVerification.identity_verified) identityVerified++;
        else if (cd.identityVerification.serial_match === "insufficient_data")
          identityInsufficient++;
        else identityUnverified++;
        if (cd.identityVerification.serial_match === "match") serialMatchCount++;
        else if (cd.identityVerification.serial_match === "mismatch") serialMismatchCount++;
        else if (cd.identityVerification.serial_match === "partial_match") serialPartialCount++;
      }
    }
    const avgIdentityScore =
      identityCasesCount > 0 ? Math.round(totalIdentityScore / identityCasesCount) : 0;

    // ── Aggregate anti-hallucination metrics across the whole dataset ──
    let totalGuardEvents = 0;
    let casesWithGuards = 0;
    let totalImagesInspected = 0;
    let totalPdfCharsExtracted = 0;
    let totalScannedPdfs = 0;
    const guardEventsByField: Record<string, number> = {};
    for (const cd of caseDetails) {
      if (cd.evidenceInspected) {
        totalImagesInspected += cd.evidenceInspected.imageCount;
        totalPdfCharsExtracted += cd.evidenceInspected.pdfCharsExtracted;
        totalScannedPdfs += cd.evidenceInspected.scannedPdfCount;
        const events = cd.evidenceInspected.guardEvents;
        if (events.length > 0) casesWithGuards++;
        totalGuardEvents += events.length;
        for (const ev of events) {
          guardEventsByField[ev.field] = (guardEventsByField[ev.field] ?? 0) + 1;
        }
      }
    }

    const avgLatencyMs = Math.round(totalLatency / analyses.length);
    const avgScore = Math.round(totalScore / analyses.length);
    const avgRetrievedChunks = analyses.length
      ? Math.round((totalChunksRetrieved / analyses.length) * 10) / 10
      : 0;
    const avgChunkSimilarity =
      chunkCount > 0
        ? Math.round((totalChunkSimilarity / chunkCount) * 1000) / 1000
        : 0;
    const rvsAccuracy =
      analyses.length > 0
        ? Math.round((rvsMatchCount / analyses.length) * 100)
        : 0;

    const scoreDistribution = Object.entries(scoreDistributionMap).map(
      ([range, count]) => ({ range, count })
    );

    return NextResponse.json({
      totalAnalyses: analyses.length,
      avgLatencyMs,
      avgScore,
      minScore,
      maxScore,
      recommendationCounts,
      scoreDistribution,
      caseDetails,
      policyChunkCount: policyChunks,
      modelsUsed: Array.from(modelsUsedSet),
      avgRetrievedChunks,
      avgChunkSimilarity,
      rvsAccuracy,
      // Anti-hallucination aggregates (used by the AI page "Grounding" panel)
      antiHallucination: {
        totalGuardEvents,
        casesWithGuards,
        totalCases: caseDetails.length,
        totalImagesInspected,
        totalPdfCharsExtracted,
        totalScannedPdfs,
        guardEventsByField,
      },
      // Multi-model ensemble aggregates (Claude + GPT + critic)
      ensemble: {
        multiModelCases,
        consensusHigh,
        consensusMedium,
        consensusLow,
        actionsMatch,
        criticAgree,
        criticDispute,
        avgCriticConfidence,
        totalDamageRegions,
        casesWithDamageRegions,
      },
      identity: {
        casesWithIdentity: identityCasesCount,
        identityVerified,
        identityUnverified,
        identityInsufficient,
        serialMatchCount,
        serialMismatchCount,
        serialPartialCount,
        avgIdentityScore,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
