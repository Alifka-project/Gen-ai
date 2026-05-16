"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import type { AiAnalysisJson } from "@/lib/ai/schema";
import { avoidedCostPerCase, resolveProductValueAed } from "@/lib/cost";

type RetrievedChunk = {
  id: string;
  policyName: string;
  sectionRef: string;
  score: number;
};

type Document = {
  id: string;
  docType: string;
  blobUrl: string;
  mimeType: string;
};

export function DashboardTabs({
  complaintText,
  productModel,
  analysis,
  documents,
  retrievedChunks,
}: {
  complaintText: string;
  productModel: string;
  analysis: AiAnalysisJson;
  documents: Document[];
  retrievedChunks: RetrievedChunk[];
}) {
  const images = documents.filter((d) => d.mimeType.startsWith("image/"));
  const nonImages = documents.filter((d) => !d.mimeType.startsWith("image/"));
  const productValue = resolveProductValueAed(
    analysis.document_analysis.product_value_aed,
    productModel
  );
  const estimatedSaving = avoidedCostPerCase(productValue);

  return (
    <Tabs defaultValue="complaint" className="w-full">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="complaint">Complaint</TabsTrigger>
        <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="policy">Policy ({retrievedChunks.length})</TabsTrigger>
        <TabsTrigger value="cost">Cost Impact</TabsTrigger>
      </TabsList>

      <TabsContent value="complaint" className="mt-3 space-y-3">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Pill>category: {analysis.complaint_analysis.category}</Pill>
            <Pill>severity: {analysis.complaint_analysis.severity}</Pill>
            <Pill>clarity: {analysis.complaint_analysis.clarity_score}/100</Pill>
          </div>
          <blockquote className="border-l-4 border-slate-200 pl-3 italic text-sm text-slate-700">
            &ldquo;{complaintText}&rdquo;
          </blockquote>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
              AI Summary
            </h4>
            <p className="text-sm text-slate-700">{analysis.case_summary}</p>
          </div>
          {analysis.complaint_analysis.missing_evidence.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Missing Evidence
              </h4>
              <ul className="text-sm text-slate-700 list-disc pl-5 space-y-0.5">
                {analysis.complaint_analysis.missing_evidence.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="images" className="mt-3 space-y-3">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Pill>visible damage: {analysis.visual_analysis.visible_damage ? "yes" : "no"}</Pill>
            <Pill>damage type: {analysis.visual_analysis.damage_type}</Pill>
            <Pill>evidence quality: {analysis.visual_analysis.evidence_quality_score}/100</Pill>
            <Pill>
              consistency: {analysis.visual_analysis.claim_image_consistency.replace(/_/g, " ")}
            </Pill>
            <Pill>serial visible: {analysis.visual_analysis.serial_number_visible ? "yes" : "no"}</Pill>
          </div>
          {analysis.visual_analysis.visual_uncertainty && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <strong>Visual uncertainty:</strong> {analysis.visual_analysis.visual_uncertainty}
            </p>
          )}
          {images.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No images attached.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((img) => (
                <a
                  key={img.id}
                  href={img.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.blobUrl}
                    alt={img.docType}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="px-2 py-1.5 text-xs text-slate-600 bg-slate-50 border-t border-slate-200">
                    {img.docType.replace(/_/g, " ")}
                  </div>
                </a>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="documents" className="mt-3 space-y-3">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Pill>
              invoice:{" "}
              {analysis.document_analysis.invoice_valid === null
                ? "unknown"
                : analysis.document_analysis.invoice_valid
                ? "valid"
                : "invalid"}
            </Pill>
            <Pill>warranty: {analysis.document_analysis.warranty_status}</Pill>
            <Pill>return window: {analysis.document_analysis.return_window_status}</Pill>
            {analysis.document_analysis.product_value_aed != null && (
              <Pill>value: AED {analysis.document_analysis.product_value_aed}</Pill>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Extracted Fields
            </h4>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {Object.entries(analysis.document_analysis.extracted_fields).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-slate-400">{k.replace(/_/g, " ")}</dt>
                  <dd className="font-medium text-slate-800">{String(v) ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
          {nonImages.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Source Files
              </h4>
              <ul className="space-y-1">
                {nonImages.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {d.docType.replace(/_/g, " ")} ({d.mimeType})
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="policy" className="mt-3 space-y-3">
        <Card className="p-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Policy Result
            </h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {analysis.policy_analysis.policy_result}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Cited Sections
            </h4>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {analysis.policy_analysis.relevant_sections.map((s, i) => (
                <li key={i} className="font-mono text-slate-700">{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Retrieved Chunks (top {retrievedChunks.length}, by cosine similarity)
            </h4>
            <ul className="space-y-1.5">
              {retrievedChunks.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="font-mono text-xs text-slate-700">
                    {c.policyName} §{c.sectionRef}
                  </span>
                  <span className="tabular-nums text-xs text-slate-400 font-medium">
                    {c.score.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="cost" className="mt-3 space-y-3">
        <Card className="p-5">
          <div className="flex items-end gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Estimated Cost Avoided (if replacement prevented)
              </p>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">
                AED {Math.round(estimatedSaving).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-3">
            <p>Breakdown per case:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Technician visit: AED 150</li>
              <li>Reverse logistics: AED 80</li>
              <li>Replacement delivery: AED 100</li>
              <li>20% open-box depreciation on product value (AED {productValue.toLocaleString()})</li>
            </ul>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}
