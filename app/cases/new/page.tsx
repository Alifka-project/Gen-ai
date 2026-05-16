import { CaseIntakeForm } from "@/components/case-intake-form";
import { PlusCircle } from "lucide-react";

export default function NewCasePage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-100 mt-0.5">
          <PlusCircle className="size-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            New Return Case
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Log a customer complaint with supporting evidence. The AI pipeline will
            analyze the images, invoice, and complaint text against company policies.
          </p>
        </div>
      </div>

      {/* Pipeline info strip */}
      <div className="flex items-center gap-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm overflow-x-auto">
        {[
          "1. Fill complaint details",
          "2. Attach damage photos + invoice",
          "3. Submit to create case",
          "4. AI analyzes via GPT-4o",
          "5. Manager reviews & decides",
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-2 whitespace-nowrap">
            {i > 0 && <span className="text-slate-300">→</span>}
            <span
              className={`inline-flex items-center gap-1.5 ${
                i === 0 ? "text-blue-700 font-semibold" : ""
              }`}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      <CaseIntakeForm />
    </div>
  );
}
