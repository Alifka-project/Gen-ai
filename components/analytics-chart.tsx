"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS: Record<string, string> = {
  approve_replacement: "#16a34a",
  reject_request: "#dc2626",
  request_more_evidence: "#ca8a04",
  remote_troubleshooting: "#2563eb",
  send_technician: "#4f46e5",
  escalate_manager: "#ea580c",
};

export function AnalyticsChart({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const data = Object.entries(counts)
    .map(([key, value]) => ({ key, label: key.replace(/_/g, " "), value }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No analyses run yet — recommendations will plot here.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" angle={-30} textAnchor="end" interval={0} height={70} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value">
            {data.map((d) => (
              <Cell key={d.key} fill={COLORS[d.key] ?? "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
