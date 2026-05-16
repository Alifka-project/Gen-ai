import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; className: string }> = {
  approve_replacement: {
    label: "Approve replacement",
    className: "bg-green-100 text-green-900 border-green-300",
  },
  reject_request: {
    label: "Reject request",
    className: "bg-red-100 text-red-900 border-red-300",
  },
  request_more_evidence: {
    label: "Request more evidence",
    className: "bg-yellow-100 text-yellow-900 border-yellow-300",
  },
  remote_troubleshooting: {
    label: "Remote troubleshoot",
    className: "bg-blue-100 text-blue-900 border-blue-300",
  },
  send_technician: {
    label: "Send technician",
    className: "bg-indigo-100 text-indigo-900 border-indigo-300",
  },
  escalate_manager: {
    label: "Escalate to manager",
    className: "bg-orange-100 text-orange-900 border-orange-300",
  },
  // Manager-decision values:
  approve: { label: "Approved", className: "bg-green-100 text-green-900 border-green-300" },
  reject: { label: "Rejected", className: "bg-red-100 text-red-900 border-red-300" },
  request_evidence: {
    label: "Evidence requested",
    className: "bg-yellow-100 text-yellow-900 border-yellow-300",
  },
  remote_troubleshoot: {
    label: "Remote troubleshoot",
    className: "bg-blue-100 text-blue-900 border-blue-300",
  },
  escalate: { label: "Escalated", className: "bg-orange-100 text-orange-900 border-orange-300" },
};

export function RecommendationBadge({
  value,
  size = "md",
}: {
  value: string;
  size?: "sm" | "md" | "lg";
}) {
  const style = STYLES[value] ?? {
    label: value,
    className: "bg-gray-100 text-gray-900 border-gray-300",
  };
  const sizeClass =
    size === "sm"
      ? "text-xs px-2 py-0.5"
      : size === "lg"
        ? "text-base px-3 py-1.5"
        : "text-sm px-2.5 py-1";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        sizeClass,
        style.className
      )}
    >
      {style.label}
    </span>
  );
}
