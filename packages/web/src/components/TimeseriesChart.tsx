// Events-over-time line chart with granularity + event-type filters.

import type { ReactNode } from "react";
import type { MetricsTimeseries, TimeseriesGranularity } from "@kamel/shared";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  EVENT_TYPE_OPTIONS,
  type EventTypeFilter,
} from "../api.js";
import { EmptyState, Panel, Skeleton } from "./Panel.js";

export function TimeseriesChart(props: {
  loading: boolean;
  timeseries: MetricsTimeseries | null;
  granularity: TimeseriesGranularity;
  eventType: EventTypeFilter | "all";
  onGranularityChange: (g: TimeseriesGranularity) => void;
  onEventTypeChange: (t: EventTypeFilter | "all") => void;
}): ReactNode {
  const tools = (
    <>
      <div className="seg" role="group" aria-label="Granularity">
        {(["hour", "day"] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={props.granularity === g}
            onClick={() => {
              props.onGranularityChange(g);
            }}
          >
            {g}
          </button>
        ))}
      </div>
      <select
        className="control"
        aria-label="Event type"
        value={props.eventType}
        onChange={(e) => {
          const value = e.target.value;
          if (value === "all" || EVENT_TYPE_OPTIONS.includes(value as EventTypeFilter)) {
            props.onEventTypeChange(value as EventTypeFilter | "all");
          }
        }}
      >
        {EVENT_TYPE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "all" ? "All types" : opt}
          </option>
        ))}
      </select>
    </>
  );

  if (props.loading && props.timeseries === null) {
    return (
      <Panel title="Events over time" tools={tools}>
        <Skeleton className="skeleton-chart" />
      </Panel>
    );
  }

  const points = props.timeseries?.points ?? [];
  const total = points.reduce((sum, p) => sum + p.count, 0);
  if (total === 0) {
    return (
      <Panel title="Events over time" tools={tools}>
        <EmptyState message="No events in this range for the selected filters." />
      </Panel>
    );
  }

  const tz = props.timeseries?.timezone ?? "UTC";
  const chartData = points.map((p) => ({
    bucket: p.bucket,
    count: p.count,
    label: formatBucket(p.bucket, props.granularity, tz),
  }));

  return (
    <Panel title="Events over time" tools={tools}>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#2a3344" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#8b97ab", fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "#8b97ab", fontSize: 11 }}
              width={40}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "#161b22",
                border: "1px solid #2a3344",
                borderRadius: 6,
              }}
              labelStyle={{ color: "#8b97ab" }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3dbaa0"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="heatmap-meta">Buckets in {tz}</div>
    </Panel>
  );
}

function formatBucket(
  iso: string,
  granularity: TimeseriesGranularity,
  timeZone: string,
): string {
  const date = new Date(iso);
  if (granularity === "day") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
  }).format(date);
}
