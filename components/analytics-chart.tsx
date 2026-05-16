"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
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

const LABELS: Record<string, string> = {
  approve_replacement: "Approve",
  reject_request: "Reject",
  request_more_evidence: "More Evidence",
  remote_troubleshooting: "Remote Fix",
  send_technician: "Technician",
  escalate_manager: "Escalate",
};

export function AnalyticsChart({ counts }: { counts: Record<string, number> }) {
  const data = Object.entries(counts)
    .map(([key, value]) => ({
      key,
      label: LABELS[key] ?? key.replace(/_/g, " "),
      fullLabel: key.replace(/_/g, " "),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No analyses run yet — recommendations will plot here.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(val, _, props) => [val, props.payload.fullLabel]}
            contentStyle={{
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.key} fill={COLORS[d.key] ?? "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecommendationPieChart({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const data = Object.entries(counts)
    .map(([key, value]) => ({
      key,
      name: LABELS[key] ?? key.replace(/_/g, " "),
      value,
      color: COLORS[key] ?? "#64748b",
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No data yet.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
