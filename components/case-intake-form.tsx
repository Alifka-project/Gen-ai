"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User,
  Tag,
  Hash,
  MessageSquare,
  Wrench,
  ImageIcon,
  FileText,
  Upload,
  X,
  CheckCircle2,
  Info,
  ChevronRight,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CATALOGUE, groupByBrand } from "@/lib/catalogue";
import type { CatalogueProduct, ProductBrand } from "@/data/products/catalogue";

const CATALOGUE_CODES = new Set(CATALOGUE.map((p) => p.modelCode));
const BRAND_GROUPS = groupByBrand();
const BRANDS = Object.keys(BRAND_GROUPS) as ProductBrand[];

const schema = z.object({
  customerName: z.string().min(1, "Customer name is required").max(200),
  brand: z.enum(["Bosch", "Samsung"] as const).refine((v) => !!v, {
    message: "Please select a brand",
  }),
  productModel: z
    .string()
    .min(1, "Please select a product model")
    .refine((v) => CATALOGUE_CODES.has(v), {
      message: "Product not in catalogue",
    }),
  serialNumber: z.string().max(200).optional(),
  requestedAction: z.enum(["replacement", "refund", "repair"]),
  complaintText: z
    .string()
    .min(20, "Please provide at least 20 characters describing the issue")
    .max(4000),
});
type FormValues = z.infer<typeof schema>;

const ACTION_OPTIONS = [
  { value: "replacement", label: "Replacement", desc: "Replace with a new unit" },
  { value: "refund", label: "Refund", desc: "Full or partial refund" },
  { value: "repair", label: "Repair", desc: "Repair the product" },
] as const;

type DocFile = { file: File; docType: "damage_photo" | "invoice" | "other" };

const STEPS = [
  { id: 1, label: "Customer & Product" },
  { id: 2, label: "Complaint Details" },
  { id: 3, label: "Evidence Upload" },
  { id: 4, label: "Review & Submit" },
];

export function CaseIntakeForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [damageFiles, setDamageFiles] = useState<File[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogueProduct | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { requestedAction: "replacement" },
  });

  const watchedBrand = watch("brand");
  const watchedModel = watch("productModel");
  const watchedAction = watch("requestedAction");
  const watchedName = watch("customerName");
  const watchedComplaint = watch("complaintText");

  useEffect(() => {
    setValue("productModel", "");
    setSelectedProduct(null);
  }, [watchedBrand, setValue]);

  useEffect(() => {
    if (watchedModel) {
      setSelectedProduct(CATALOGUE.find((p) => p.modelCode === watchedModel) ?? null);
    } else {
      setSelectedProduct(null);
    }
  }, [watchedModel]);

  const brandProducts = watchedBrand && BRAND_GROUPS[watchedBrand] ? BRAND_GROUPS[watchedBrand] : [];
  const totalFiles = damageFiles.length + invoiceFiles.length + otherFiles.length;

  function addDamageFiles(list: FileList | null) {
    if (!list) return;
    setDamageFiles((prev) => [...prev, ...Array.from(list).filter((f) => f.type.startsWith("image/"))]);
  }
  function addInvoiceFiles(list: FileList | null) {
    if (!list) return;
    setInvoiceFiles((prev) => [...prev, ...Array.from(list).filter((f) => f.type === "application/pdf" || f.type.startsWith("image/"))]);
  }
  function addOtherFiles(list: FileList | null) {
    if (!list) return;
    setOtherFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function uploadFile(caseId: string, file: File, docType: string) {
    const form = new FormData();
    form.append("file", file);
    form.append("docType", docType);
    return fetch(`/api/cases/${caseId}/upload`, { method: "POST", body: form });
  }

  async function goNext() {
    if (currentStep === 1) {
      const valid = await trigger(["customerName", "brand", "productModel"]);
      if (!valid) return;
    }
    if (currentStep === 2) {
      const valid = await trigger(["requestedAction", "complaintText"]);
      if (!valid) return;
    }
    setCurrentStep((s) => Math.min(s + 1, 4));
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      // Step 1: Create case
      setSubmitStatus("Creating case...");
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: values.customerName,
          productModel: values.productModel,
          serialNumber: values.serialNumber || null,
          complaintText: values.complaintText,
          requestedAction: values.requestedAction,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `case create failed: ${res.status}`);
      }
      const { id } = (await res.json()) as { id: string };

      // Step 2: Upload files
      const allFiles: DocFile[] = [
        ...damageFiles.map((f) => ({ file: f, docType: "damage_photo" as const })),
        ...invoiceFiles.map((f) => ({ file: f, docType: "invoice" as const })),
        ...otherFiles.map((f) => ({ file: f, docType: "other" as const })),
      ];

      let uploaded = 0;
      for (const { file, docType } of allFiles) {
        setSubmitStatus(`Uploading ${file.name}... (${uploaded + 1}/${allFiles.length})`);
        const up = await uploadFile(id, file, docType);
        if (up.ok) {
          uploaded++;
        } else {
          const err = await up.json().catch(() => ({}));
          toast.error(`Upload failed for ${file.name}: ${err.error ?? up.status}`);
        }
      }

      // Step 3: Run AI analysis
      setSubmitStatus("Running AI analysis (Gemini 2.0 Flash)...");
      const analyzeRes = await fetch(`/api/cases/${id}/analyze`, { method: "POST" });
      if (analyzeRes.ok) {
        const analyzeBody = await analyzeRes.json();
        toast.success(
          `Case created, ${uploaded} file(s) uploaded, AI analysis complete (RVS: ${analyzeBody.analysis?.replacement_validity_score ?? "N/A"}).`
        );
      } else {
        const err = await analyzeRes.json().catch(() => ({}));
        toast.warning(`Case created with ${uploaded} file(s), but AI analysis failed: ${err.error ?? "unknown error"}. You can re-run it on the case page.`);
      }

      router.push(`/cases/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
      setSubmitting(false);
      setSubmitStatus("");
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => {
                  if (step.id < currentStep) setCurrentStep(step.id);
                }}
                className="flex items-center gap-2 group"
              >
                <div
                  className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep > step.id
                      ? "bg-emerald-500 text-white"
                      : currentStep === step.id
                      ? "bg-blue-600 text-white shadow-md ring-4 ring-blue-100"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    currentStep === step.id
                      ? "text-blue-700"
                      : currentStep > step.id
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-2">
                  <div
                    className={`h-0.5 rounded-full transition-colors ${
                      currentStep > step.id ? "bg-emerald-400" : "bg-slate-200"
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Customer & Product */}
        {currentStep === 1 && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Customer & Product Information</h2>
              <p className="text-sm text-slate-500 mt-0.5">Identify the customer and the product model from our catalogue.</p>
            </div>

            {/* Customer Name */}
            <div>
              <FieldLabel icon={<User className="size-3.5" />} label="Customer Name" required />
              <Input {...register("customerName")} placeholder="e.g. Aisha Al-Mansouri" className="mt-1" />
              <FieldNote>Must match the name on the invoice for verification.</FieldNote>
              {errors.customerName && <FieldError msg={errors.customerName.message!} />}
            </div>

            {/* Brand */}
            <div>
              <FieldLabel icon={<Tag className="size-3.5" />} label="Brand" required />
              <div className="mt-1.5 flex gap-3">
                {BRANDS.map((brand) => (
                  <label
                    key={brand}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                      watchedBrand === brand
                        ? brand === "Bosch"
                          ? "border-red-500 bg-red-50 shadow-sm"
                          : "border-blue-600 bg-blue-50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input type="radio" value={brand} {...register("brand")} className="sr-only" />
                    <span className={`text-sm font-bold ${brand === "Bosch" ? "text-red-700" : "text-blue-800"}`}>
                      {brand}
                    </span>
                    {watchedBrand === brand && (
                      <CheckCircle2 className={`size-4 ${brand === "Bosch" ? "text-red-500" : "text-blue-600"}`} />
                    )}
                  </label>
                ))}
              </div>
              {errors.brand && <FieldError msg={errors.brand.message!} />}
            </div>

            {/* Product Model */}
            {watchedBrand && (
              <div>
                <FieldLabel icon={<Tag className="size-3.5" />} label="Product Model" required />
                <p className="text-xs text-slate-400 mb-2">Select the product from the {watchedBrand} catalogue ({brandProducts.length} models)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {brandProducts.map((product) => (
                    <label
                      key={product.modelCode}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        watchedModel === product.modelCode
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <input type="radio" value={product.modelCode} {...register("productModel")} className="sr-only" />
                      <div className="shrink-0 w-14 h-14 flex items-center justify-center rounded-lg bg-white border border-slate-100 overflow-hidden">
                        {product.imageFile ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/products/${product.imageFile}`} alt={product.modelCode} className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <span className="text-[10px] text-slate-400 text-center">{product.brand}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 font-mono">{product.modelCode}</p>
                        <p className="text-[10px] text-slate-500 truncate">{product.series}</p>
                        <p className="text-[10px] text-slate-400">
                          {product.capacityKg} kg {product.spinRpm ? `| ${product.spinRpm} RPM` : ""}
                        </p>
                      </div>
                      {watchedModel === product.modelCode && <CheckCircle2 className="size-4 text-blue-500 shrink-0" />}
                    </label>
                  ))}
                </div>
                {errors.productModel && <FieldError msg={errors.productModel.message!} />}
              </div>
            )}

            {/* Selected Product Summary */}
            {selectedProduct && (
              <div className="rounded-xl bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 p-4 flex items-start gap-4">
                <div className="shrink-0 w-16 h-16 flex items-center justify-center rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                  {selectedProduct.imageFile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/products/${selectedProduct.imageFile}`} alt={selectedProduct.modelCode} className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-xs text-slate-400">{selectedProduct.brand}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">{selectedProduct.brand} {selectedProduct.modelCode}</p>
                  <p className="text-xs text-slate-500">{selectedProduct.series}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selectedProduct.highlightFeatures.slice(0, 4).map((f) => (
                      <span key={f} className="text-[10px] bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">{f}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Est. value</p>
                  <p className="text-sm font-bold text-slate-900">AED {selectedProduct.estimatedValueAed.toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Serial Number */}
            <div>
              <FieldLabel icon={<Hash className="size-3.5" />} label="Serial Number" />
              <Input {...register("serialNumber")} placeholder="e.g. WGG444-2024-018" className="mt-1 font-mono" />
              <FieldNote>Found on the product label or warranty card. Used to verify warranty status.</FieldNote>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={goNext} className="gap-1.5">
                Next: Complaint Details <ChevronRight className="size-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Complaint Details */}
        {currentStep === 2 && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Complaint Details</h2>
              <p className="text-sm text-slate-500 mt-0.5">Describe what happened and what the customer is requesting.</p>
            </div>

            <div>
              <FieldLabel icon={<Wrench className="size-3.5" />} label="Requested Action" required />
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {ACTION_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                      watchedAction === opt.value
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input type="radio" value={opt.value} {...register("requestedAction")} className="sr-only" />
                    <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel icon={<MessageSquare className="size-3.5" />} label="Complaint Description" required />
              <Textarea
                {...register("complaintText")}
                rows={6}
                placeholder="Describe the issue in detail: what happened, when it started, what the customer observed, any error codes, what they already tried. This text is analyzed by the AI alongside attached evidence."
                className="mt-1"
              />
              <FieldNote>Minimum 20 characters. More detail = more accurate AI analysis.</FieldNote>
              {errors.complaintText && <FieldError msg={errors.complaintText.message!} />}
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button type="button" onClick={goNext} className="gap-1.5">
                Next: Upload Evidence <ChevronRight className="size-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Evidence Upload */}
        {currentStep === 3 && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Evidence & Documents</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Upload supporting evidence. The AI will analyze images and PDFs via Gemini multimodal processing.
              </p>
            </div>

            <UploadZone
              label="Product Damage / Defect Photos"
              icon={<ImageIcon className="size-5 text-orange-400" />}
              accept="image/jpeg,image/png,image/webp,image/heic"
              note="Photos of visible damage, defects, or packaging issues (JPG, PNG, WebP)"
              files={damageFiles}
              onAdd={addDamageFiles}
              onRemove={(i) => setDamageFiles((prev) => prev.filter((_, idx) => idx !== i))}
              color="orange"
            />

            <UploadZone
              label="Invoice / Purchase Receipt"
              icon={<FileText className="size-5 text-blue-400" />}
              accept="application/pdf,image/jpeg,image/png"
              note="Original purchase invoice or receipt (PDF preferred). Verifies warranty and return window."
              files={invoiceFiles}
              onAdd={addInvoiceFiles}
              onRemove={(i) => setInvoiceFiles((prev) => prev.filter((_, idx) => idx !== i))}
              color="blue"
            />

            <UploadZone
              label="Other Documents"
              icon={<Upload className="size-5 text-slate-400" />}
              accept="application/pdf,image/*"
              note="Delivery note, warranty card, return request form, or any other supporting document"
              files={otherFiles}
              onAdd={addOtherFiles}
              onRemove={(i) => setOtherFiles((prev) => prev.filter((_, idx) => idx !== i))}
              color="slate"
            />

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button type="button" onClick={goNext} className="gap-1.5">
                Next: Review <ChevronRight className="size-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 4: Review & Submit */}
        {currentStep === 4 && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Review & Submit</h2>
              <p className="text-sm text-slate-500 mt-0.5">Review the case details before submitting for AI analysis.</p>
            </div>

            {/* Summary */}
            <div className="space-y-3">
              <ReviewRow label="Customer Name" value={watchedName || "—"} />
              <ReviewRow label="Brand" value={watchedBrand || "—"} />
              <ReviewRow label="Product Model" value={selectedProduct ? `${selectedProduct.modelCode} — ${selectedProduct.series}` : "—"} />
              <ReviewRow label="Serial Number" value={watch("serialNumber") || "Not provided"} />
              <ReviewRow label="Requested Action" value={watchedAction?.charAt(0).toUpperCase() + (watchedAction?.slice(1) ?? "")} />
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Complaint</p>
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                  {watchedComplaint || "—"}
                </p>
              </div>
              <ReviewRow label="Files Attached" value={`${totalFiles} file(s) — ${damageFiles.length} damage photo(s), ${invoiceFiles.length} invoice(s), ${otherFiles.length} other`} />
            </div>

            {/* AI Info */}
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">
                After submission, the system will: (1) Create the case record, (2) Upload all attached files,
                (3) Automatically run AI analysis using <strong>Gemini 2.0 Flash</strong> multimodal pipeline
                with RAG policy retrieval (pgvector). You will be redirected to the case detail page with
                the AI recommendation.
              </p>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(3)}>
                Back
              </Button>
              <Button type="submit" disabled={submitting} className="gap-1.5 px-6">
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {submitStatus}
                  </>
                ) : (
                  "Create Case & Run Analysis"
                )}
              </Button>
            </div>
          </Card>
        )}
      </form>
    </div>
  );
}

/* ——— Sub-components ——— */

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-100">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-900 text-right max-w-xs">{value}</p>
    </div>
  );
}

function FieldLabel({ icon, label, required }: { icon: React.ReactNode; label: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 mb-0.5">
      <span className="text-slate-400">{icon}</span>
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    </div>
  );
}

function FieldNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-400 mt-1">{children}</p>;
}

function FieldError({ msg }: { msg: string }) {
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

function UploadZone({
  label, icon, accept, note, files, onAdd, onRemove, color,
}: {
  label: string; icon: React.ReactNode; accept: string; note: string;
  files: File[]; onAdd: (list: FileList | null) => void; onRemove: (i: number) => void;
  color: "orange" | "blue" | "slate";
}) {
  const styles = {
    orange: { border: "border-orange-200 hover:border-orange-300", bg: "bg-orange-50/50" },
    blue: { border: "border-blue-200 hover:border-blue-300", bg: "bg-blue-50/50" },
    slate: { border: "border-slate-200 hover:border-slate-300", bg: "bg-slate-50/50" },
  }[color];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {files.length > 0 && (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
            {files.length} file(s)
          </span>
        )}
      </div>
      <label className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${styles.border} ${styles.bg}`}>
        <Upload className="size-5 text-slate-400 mb-1.5" />
        <span className="text-xs text-slate-600 font-medium">Click to upload or drag and drop</span>
        <span className="text-[10px] text-slate-400 mt-0.5 text-center">{note}</span>
        <input type="file" accept={accept} multiple className="sr-only" onChange={(e) => onAdd(e.target.files)} />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
              {f.type.startsWith("image/") ? <ImageIcon className="size-3.5 text-slate-400 shrink-0" /> : <FileText className="size-3.5 text-slate-400 shrink-0" />}
              <span className="text-xs text-slate-700 truncate flex-1 font-mono">{f.name}</span>
              <span className="text-[10px] text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
