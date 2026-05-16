import { CaseIntakeForm } from "@/components/case-intake-form";

export default function NewCasePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New return case</h1>
        <p className="text-sm text-muted-foreground">
          Log a customer complaint with any supporting photos or invoice. The AI will run an
          evidence-first analysis after you submit.
        </p>
      </div>
      <CaseIntakeForm />
    </div>
  );
}
