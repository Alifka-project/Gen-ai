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
  Area,
  AreaChart,
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
      <p className="text-sm text-slate-400 py-8 text-center">
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
      <p className="text-sm text-slate-400 py-8 text-center">
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

const STATUS_COLORS: Record<string, string> = {
  new: "#94a3b8",
  analyzing: "#3b82f6",
  analyzed: "#8b5cf6",
  decided: "#10b981",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  analyzing: "Analyzing",
  analyzed: "Analyzed",
  decided: "Decided",
};

export function StatusPieChart({
  statusCounts,
}: {
  statusCounts: Record<string, number>;
}) {
  const data = Object.entries(statusCounts)
    .map(([key, value]) => ({
      key,
      name: STATUS_LABELS[key] ?? key,
      value,
      color: STATUS_COLORS[key] ?? "#94a3b8",
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">
        No cases yet.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
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

export function CaseTimelineChart({
  timeline,
}: {
  timeline: Array<{ date: string; cases: number; analyses: number }>;
}) {
  if (timeline.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">
        No timeline data yet.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={timeline} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 11,
            }}
          />
          <Area
            type="monotone"
            dataKey="cases"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.1}
            strokeWidth={2}
            name="Cases Created"
          />
          <Area
            type="monotone"
            dataKey="analyses"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.1}
            strokeWidth={2}
            name="Analyses Run"
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreDistributionChart({
  scores,
}: {
  scores: number[];
}) {
  const buckets = [
    { range: "0-30", min: 0, max: 30, color: "#dc2626", count: 0 },
    { range: "31-50", min: 31, max: 50, color: "#ca8a04", count: 0 },
    { range: "51-70", min: 51, max: 70, color: "#2563eb", count: 0 },
    { range: "71-85", min: 71, max: 85, color: "#8b5cf6", count: 0 },
    { range: "86-100", min: 86, max: 100, color: "#16a34a", count: 0 },
  ];

  for (const s of scores) {
    for (const b of buckets) {
      if (s >= b.min && s <= b.max) { b.count++; break; }
    }
  }

  if (scores.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">
        No scores yet.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="range"
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Cases">
            {buckets.map((b) => (
              <Cell key={b.range} fill={b.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
