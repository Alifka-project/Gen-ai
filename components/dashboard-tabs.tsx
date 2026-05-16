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
      <TabsList>
        <TabsTrigger value="complaint">Complaint</TabsTrigger>
        <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="policy">Policy ({retrievedChunks.length})</TabsTrigger>
        <TabsTrigger value="cost">Cost</TabsTrigger>
      </TabsList>

      <TabsContent value="complaint" className="mt-4 space-y-3">
        <Card className="p-4 space-y-2">
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <Pill>category: {analysis.complaint_analysis.category}</Pill>
            <Pill>severity: {analysis.complaint_analysis.severity}</Pill>
            <Pill>clarity: {analysis.complaint_analysis.clarity_score}/100</Pill>
          </div>
          <blockquote className="border-l-4 border-muted pl-3 italic text-sm text-foreground/90">
            “{complaintText}”
          </blockquote>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
              AI summary
            </h4>
            <p className="text-sm">{analysis.case_summary}</p>
          </div>
          {analysis.complaint_analysis.missing_evidence.length > 0 ? (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
                Missing evidence
              </h4>
              <ul className="text-sm list-disc pl-5">
                {analysis.complaint_analysis.missing_evidence.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </TabsContent>

      <TabsContent value="images" className="mt-4 space-y-3">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <Pill>visible damage: {analysis.visual_analysis.visible_damage ? "yes" : "no"}</Pill>
            <Pill>damage type: {analysis.visual_analysis.damage_type}</Pill>
            <Pill>evidence quality: {analysis.visual_analysis.evidence_quality_score}/100</Pill>
            <Pill>
              consistency: {analysis.visual_analysis.claim_image_consistency.replace(/_/g, " ")}
            </Pill>
            <Pill>
              serial visible: {analysis.visual_analysis.serial_number_visible ? "yes" : "no"}
            </Pill>
          </div>
          {analysis.visual_analysis.visual_uncertainty ? (
            <p className="text-xs text-amber-700">
              <strong>Uncertainty:</strong> {analysis.visual_analysis.visual_uncertainty}
            </p>
          ) : null}
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">No images attached.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((img) => (
                <a
                  key={img.id}
                  href={img.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md overflow-hidden border bg-muted hover:opacity-90"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.blobUrl}
                    alt={img.docType}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="px-2 py-1 text-xs bg-background border-t">
                    {img.docType}
                  </div>
                </a>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="documents" className="mt-4 space-y-3">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center text-xs">
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
            {analysis.document_analysis.product_value_aed != null ? (
              <Pill>value: AED {analysis.document_analysis.product_value_aed}</Pill>
            ) : null}
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Extracted fields
            </h4>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
              {Object.entries(analysis.document_analysis.extracted_fields).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="text-muted-foreground">{k.replace(/_/g, " ")}:</dt>
                  <dd className="font-medium">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
          {nonImages.length > 0 ? (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Source files
              </h4>
              <ul className="text-sm space-y-1">
                {nonImages.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {d.docType} ({d.mimeType})
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </TabsContent>

      <TabsContent value="policy" className="mt-4 space-y-3">
        <Card className="p-4 space-y-3">
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Cited policy sections
            </h4>
            <ul className="text-sm list-disc pl-5">
              {analysis.policy_analysis.relevant_sections.map((s, i) => (
                <li key={i} className="font-mono">{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Policy result
            </h4>
            <p className="text-sm whitespace-pre-wrap">{analysis.policy_analysis.policy_result}</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Retrieved chunks (top {retrievedChunks.length}, ranked by cosine similarity)
            </h4>
            <ul className="space-y-1.5">
              {retrievedChunks.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded border bg-muted/40 px-3 py-1.5 text-xs"
                >
                  <span className="font-mono">
                    {c.policyName} §{c.sectionRef}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    score {c.score.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="cost" className="mt-4 space-y-3">
        <Card className="p-4 space-y-2">
          <p className="text-sm">
            If this recommendation prevents an unnecessary replacement, the estimated cost avoided
            for this case is:
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            AED {Math.round(estimatedSaving).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            = technician visit (150) + reverse logistics (80) + replacement delivery (100) + 20% open-box
            depreciation on product value (AED {productValue}).
          </p>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}
