// Persistent governance banner — brief §25 and proposal §21.3.
// "AI output is advisory. Final decision belongs to the authorized manager."

import { ShieldAlert } from "lucide-react";

export function GovernanceBanner() {
  return (
    <div className="bg-amber-500 border-b border-amber-600 px-4 py-1.5 text-center text-xs text-white flex items-center justify-center gap-2">
      <ShieldAlert className="size-3.5 shrink-0" />
      <span>
        <strong>AI output is advisory only.</strong> All recommendations must be reviewed and
        authorised by a qualified manager before action is taken. Final decision belongs to the
        authorised manager.
      </span>
    </div>
  );
}
