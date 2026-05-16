"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  customerName: z.string().min(1, "Required").max(200),
  productModel: z.string().min(1, "Required").max(200),
  serialNumber: z.string().max(200).optional(),
  complaintText: z.string().min(10, "Describe the complaint in at least 10 characters").max(4000),
  requestedAction: z.enum(["replacement", "refund", "repair"]),
});
type FormValues = z.infer<typeof schema>;

const ALLOWED_DOC_TYPES = [
  { value: "image", label: "Product image" },
  { value: "invoice", label: "Invoice (PDF)" },
  { value: "delivery_note", label: "Delivery note" },
  { value: "warranty", label: "Warranty card" },
  { value: "return_request", label: "Return request form" },
] as const;

export function CaseIntakeForm() {
  const router = useRouter();
  const [files, setFiles] = useState<{ file: File; docType: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { requestedAction: "replacement" },
  });

  function inferDocType(file: File): string {
    if (file.type === "application/pdf") return "invoice";
    if (file.type.startsWith("image/")) return "image";
    return "return_request";
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const added = Array.from(list).map((file) => ({
      file,
      docType: inferDocType(file),
    }));
    setFiles((prev) => [...prev, ...added]);
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

      let uploadedCount = 0;
      let uploadFailures = 0;
      for (const { file, docType } of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("docType", docType);
        const up = await fetch(`/api/cases/${id}/upload`, {
          method: "POST",
          body: form,
        });
        if (up.ok) {
          uploadedCount++;
        } else {
          uploadFailures++;
          const err = await up.json().catch(() => ({}));
          toast.error(`Upload failed for ${file.name}: ${err.error ?? up.status}`);
        }
      }

      toast.success(
        `Case created (${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded${uploadFailures > 0 ? `, ${uploadFailures} failed` : ""}).`
      );
      router.push(`/cases/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6 max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Customer name</label>
          <Input {...register("customerName")} placeholder="e.g. Aisha Khan" />
          {errors.customerName ? (
            <p className="text-xs text-red-600 mt-1">{errors.customerName.message}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Product model</label>
            <Input {...register("productModel")} placeholder="e.g. RX-450 Refrigerator" />
            {errors.productModel ? (
              <p className="text-xs text-red-600 mt-1">{errors.productModel.message}</p>
            ) : null}
          </div>
          <div>
            <label className="text-sm font-medium">Serial number (optional)</label>
            <Input {...register("serialNumber")} placeholder="e.g. RX450-2024-001" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Requested action</label>
          <select
            {...register("requestedAction")}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="replacement">Replacement</option>
            <option value="refund">Refund</option>
            <option value="repair">Repair</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Complaint description</label>
          <Textarea
            {...register("complaintText")}
            rows={5}
            placeholder="Describe the issue the customer reported, including any context they shared (dates, observations, what they tried)."
          />
          {errors.complaintText ? (
            <p className="text-xs text-red-600 mt-1">{errors.complaintText.message}</p>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-medium">Evidence files (images, invoice PDF)</label>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="cursor-pointer"
          />
          {files.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-mono truncate flex-1">{f.file.name}</span>
                  <select
                    value={f.docType}
                    onChange={(e) => {
                      const docType = e.target.value;
                      setFiles((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, docType } : x))
                      );
                    }}
                    className="h-7 rounded border border-input bg-background px-1.5 text-xs"
                  >
                    {ALLOWED_DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-600 hover:underline"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create case"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
