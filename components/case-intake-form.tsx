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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CATALOGUE, groupByBrand } from "@/lib/catalogue";
import { ProductIcon } from "@/components/product-icon";
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
  {
    value: "replacement",
    label: "Replacement",
    desc: "Customer wants the product replaced with a new unit",
    color: "blue",
  },
  {
    value: "refund",
    label: "Refund",
    desc: "Customer wants their money back",
    color: "violet",
  },
  {
    value: "repair",
    label: "Repair",
    desc: "Customer wants the product repaired",
    color: "emerald",
  },
] as const;

type DocFile = { file: File; docType: "damage_photo" | "invoice" | "other" };

export function CaseIntakeForm() {
  const router = useRouter();
  const [damageFiles, setDamageFiles] = useState<File[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogueProduct | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { requestedAction: "replacement" },
  });

  const watchedBrand = watch("brand");
  const watchedModel = watch("productModel");
  const watchedAction = watch("requestedAction");

  // When brand changes, reset the product model
  useEffect(() => {
    setValue("productModel", "");
    setSelectedProduct(null);
  }, [watchedBrand, setValue]);

  // Update selected product when model changes
  useEffect(() => {
    if (watchedModel) {
      const product = CATALOGUE.find((p) => p.modelCode === watchedModel) ?? null;
      setSelectedProduct(product);
    } else {
      setSelectedProduct(null);
    }
  }, [watchedModel]);

  const brandProducts =
    watchedBrand && BRAND_GROUPS[watchedBrand] ? BRAND_GROUPS[watchedBrand] : [];

  function addDamageFiles(list: FileList | null) {
    if (!list) return;
    setDamageFiles((prev) => [
      ...prev,
      ...Array.from(list).filter((f) => f.type.startsWith("image/")),
    ]);
  }

  function addInvoiceFiles(list: FileList | null) {
    if (!list) return;
    setInvoiceFiles((prev) => [
      ...prev,
      ...Array.from(list).filter(
        (f) => f.type === "application/pdf" || f.type.startsWith("image/")
      ),
    ]);
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

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
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

      // Upload all files
      const allFiles: DocFile[] = [
        ...damageFiles.map((f) => ({ file: f, docType: "damage_photo" as const })),
        ...invoiceFiles.map((f) => ({ file: f, docType: "invoice" as const })),
        ...otherFiles.map((f) => ({ file: f, docType: "other" as const })),
      ];

      let uploaded = 0;
      let failed = 0;
      for (const { file, docType } of allFiles) {
        const up = await uploadFile(id, file, docType);
        if (up.ok) uploaded++;
        else {
          failed++;
          const err = await up.json().catch(() => ({}));
          toast.error(`Upload failed for ${file.name}: ${err.error ?? up.status}`);
        }
      }

      toast.success(
        `Case created (${uploaded} file${uploaded !== 1 ? "s" : ""} uploaded${
          failed > 0 ? `, ${failed} failed` : ""
        }).`
      );
      router.push(`/cases/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      {/* Section 1: Customer & Product */}
      <Card className="p-6 bg-white shadow-sm border-slate-200">
        <SectionTitle step={1} label="Customer & Product Information" />
        <div className="mt-4 space-y-4">
          {/* Customer Name */}
          <div>
            <FieldLabel icon={<User className="size-3.5" />} label="Customer Name" required />
            <Input
              {...register("customerName")}
              placeholder="e.g. Aisha Al-Mansouri"
              className="mt-1"
            />
            <FieldNote>Must match the name on the invoice for verification.</FieldNote>
            {errors.customerName && <FieldError msg={errors.customerName.message!} />}
          </div>

          {/* Brand */}
          <div>
            <FieldLabel icon={<Tag className="size-3.5" />} label="Brand" required />
            <div className="mt-1 flex gap-3">
              {BRANDS.map((brand) => (
                <label
                  key={brand}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                    watchedBrand === brand
                      ? brand === "Bosch"
                        ? "border-red-500 bg-red-50"
                        : "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    value={brand}
                    {...register("brand")}
                    className="sr-only"
                  />
                  <span
                    className={`text-sm font-bold ${
                      brand === "Bosch" ? "text-red-700" : "text-blue-800"
                    }`}
                  >
                    {brand}
                  </span>
                  {watchedBrand === brand && (
                    <CheckCircle2
                      className={`size-4 ${
                        brand === "Bosch" ? "text-red-500" : "text-blue-600"
                      }`}
                    />
                  )}
                </label>
              ))}
            </div>
            {errors.brand && <FieldError msg={errors.brand.message!} />}
          </div>

          {/* Product Model — filtered by brand */}
          {watchedBrand && (
            <div>
              <FieldLabel icon={<Tag className="size-3.5" />} label="Product Model" required />
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {brandProducts.map((product) => (
                  <label
                    key={product.modelCode}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      watchedModel === product.modelCode
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      value={product.modelCode}
                      {...register("productModel")}
                      className="sr-only"
                    />
                    <ProductIcon
                      category={product.category}
                      brand={product.brand}
                      size={48}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 font-mono">
                        {product.modelCode}
                      </p>
                      <p className="text-[10px] text-slate-500 leading-snug">
                        {product.series}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {product.capacityKg} kg{" "}
                        {product.spinRpm ? `· ${product.spinRpm} RPM` : ""}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-600">
                        AED {product.estimatedValueAed.toLocaleString()}
                      </p>
                    </div>
                    {watchedModel === product.modelCode && (
                      <CheckCircle2 className="size-4 text-blue-500 shrink-0 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
              {errors.productModel && <FieldError msg={errors.productModel.message!} />}
            </div>
          )}

          {/* Selected Product Summary */}
          {selectedProduct && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-start gap-3">
              <ProductIcon
                category={selectedProduct.category}
                brand={selectedProduct.brand}
                size={56}
              />
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {selectedProduct.brand} {selectedProduct.modelCode}
                </p>
                <p className="text-xs text-slate-500">{selectedProduct.series}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedProduct.highlightFeatures.slice(0, 3).map((f) => (
                    <span
                      key={f}
                      className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-auto text-right shrink-0">
                <p className="text-xs text-slate-400">Est. value</p>
                <p className="text-sm font-bold text-slate-900">
                  AED {selectedProduct.estimatedValueAed.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Serial Number */}
          <div>
            <FieldLabel icon={<Hash className="size-3.5" />} label="Device Serial Number" />
            <Input
              {...register("serialNumber")}
              placeholder="e.g. WGG444-2024-018"
              className="mt-1 font-mono"
            />
            <FieldNote>
              Found on the product label or warranty card. Used to verify warranty status.
            </FieldNote>
          </div>
        </div>
      </Card>

      {/* Section 2: Complaint Details */}
      <Card className="p-6 bg-white shadow-sm border-slate-200">
        <SectionTitle step={2} label="Complaint Details" />
        <div className="mt-4 space-y-4">
          {/* Requested Action */}
          <div>
            <FieldLabel icon={<Wrench className="size-3.5" />} label="Requested Action" required />
            <div className="mt-1 grid grid-cols-3 gap-2">
              {ACTION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    watchedAction === opt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    value={opt.value}
                    {...register("requestedAction")}
                    className="sr-only"
                  />
                  <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Complaint Description */}
          <div>
            <FieldLabel
              icon={<MessageSquare className="size-3.5" />}
              label="Complaint Description"
              required
            />
            <Textarea
              {...register("complaintText")}
              rows={6}
              placeholder="Describe the issue in detail: what happened, when it started, what the customer observed, any error codes, what they already tried, and the context at time of delivery. This text will be analyzed by the AI alongside the attached evidence."
              className="mt-1"
            />
            <FieldNote>
              Minimum 20 characters. The more detail provided, the more accurate the AI analysis.
            </FieldNote>
            {errors.complaintText && <FieldError msg={errors.complaintText.message!} />}
          </div>
        </div>
      </Card>

      {/* Section 3: Evidence Upload */}
      <Card className="p-6 bg-white shadow-sm border-slate-200">
        <SectionTitle step={3} label="Evidence & Documents" />
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Upload supporting evidence. The AI will analyze images and PDFs directly via Gemini
          multimodal processing.
        </p>

        <div className="space-y-4">
          {/* Damage Photos */}
          <UploadZone
            label="Product Damage / Defect Photos"
            icon={<ImageIcon className="size-5 text-orange-400" />}
            accept="image/jpeg,image/png,image/webp,image/heic"
            note="Photos of visible damage, defects, or packaging issues (JPG, PNG, WebP, HEIC)"
            files={damageFiles}
            onAdd={addDamageFiles}
            onRemove={(i) => setDamageFiles((prev) => prev.filter((_, idx) => idx !== i))}
            color="orange"
          />

          {/* Invoice */}
          <UploadZone
            label="Invoice / Purchase Receipt"
            icon={<FileText className="size-5 text-blue-400" />}
            accept="application/pdf,image/jpeg,image/png"
            note="Original purchase invoice or receipt (PDF preferred). Used to verify warranty and return window."
            files={invoiceFiles}
            onAdd={addInvoiceFiles}
            onRemove={(i) => setInvoiceFiles((prev) => prev.filter((_, idx) => idx !== i))}
            color="blue"
          />

          {/* Other Documents */}
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
        </div>
      </Card>

      {/* AI Info box */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          After submission, the AI pipeline will automatically embed the complaint text, retrieve
          relevant policy chunks via vector search (pgvector), and analyze all uploaded images/PDFs
          using <strong>Gemini 2.0 Flash</strong> multimodal processing. Click{" "}
          <strong>Run Analysis</strong> on the case page to trigger the pipeline.
        </p>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-slate-400">
          {damageFiles.length + invoiceFiles.length + otherFiles.length} file(s) attached
        </p>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
        >
          {submitting ? "Creating case..." : "Create Case & Run Analysis"}
        </Button>
      </div>
    </form>
  );
}

/* ——— Sub-components ——— */

function SectionTitle({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="size-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
        {step}
      </div>
      <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
    </div>
  );
}

function FieldLabel({
  icon,
  label,
  required,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
}) {
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
  label,
  icon,
  accept,
  note,
  files,
  onAdd,
  onRemove,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  accept: string;
  note: string;
  files: File[];
  onAdd: (list: FileList | null) => void;
  onRemove: (i: number) => void;
  color: "orange" | "blue" | "slate";
}) {
  const borderColor =
    color === "orange"
      ? "border-orange-200 hover:border-orange-300"
      : color === "blue"
      ? "border-blue-200 hover:border-blue-300"
      : "border-slate-200 hover:border-slate-300";

  const bgColor =
    color === "orange"
      ? "bg-orange-50"
      : color === "blue"
      ? "bg-blue-50"
      : "bg-slate-50";

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <label
        className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${borderColor} ${bgColor}`}
      >
        <Upload className="size-5 text-slate-400 mb-1.5" />
        <span className="text-xs text-slate-500">
          Click to upload or drag and drop
        </span>
        <span className="text-[10px] text-slate-400 mt-0.5 text-center">{note}</span>
        <input
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={(e) => onAdd(e.target.files)}
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-1.5"
            >
              {f.type.startsWith("image/") ? (
                <ImageIcon className="size-3.5 text-slate-400 shrink-0" />
              ) : (
                <FileText className="size-3.5 text-slate-400 shrink-0" />
              )}
              <span className="text-xs text-slate-700 truncate flex-1 font-mono">
                {f.name}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">
                {(f.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-red-400 hover:text-red-600 transition-colors shrink-0"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
