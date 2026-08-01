// Typed fetch wrapper — validates every metrics response against shared Zod schemas.

import {
  EventTypeFilterSchema,
  MetricsFunnelSchema,
  MetricsHeatmapSchema,
  MetricsPipelineHealthSchema,
  MetricsRoutesSchema,
  MetricsSummarySchema,
  MetricsTimeseriesSchema,
  type MetricsFunnel,
  type MetricsHeatmap,
  type MetricsPipelineHealth,
  type MetricsRoutes,
  type MetricsSummary,
  type MetricsTimeseries,
  type TimeseriesGranularity,
} from "@kamel/shared";
import type { z } from "zod";

export type EventTypeFilter = z.infer<typeof EventTypeFilterSchema>;

export type DateRangeKey = "24h" | "7d" | "30d";

export type MetricsQuery = {
  from: string;
  to: string;
};

function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : "";
}

async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  params: Record<string, string | undefined>,
): Promise<T> {
  const response = await fetch(`${path}${toQuery(params)}`);
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status})`);
  }
  const body: unknown = await response.json();
  return schema.parse(body);
}

export function rangeForKey(key: DateRangeKey, now = new Date()): MetricsQuery {
  const to = now.toISOString();
  const ms =
    key === "24h"
      ? 24 * 60 * 60 * 1000
      : key === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  return { from: new Date(now.getTime() - ms).toISOString(), to };
}

export function fetchSummary(range: MetricsQuery): Promise<MetricsSummary> {
  return getJson("/metrics/summary", MetricsSummarySchema, range);
}

export function fetchFunnel(range: MetricsQuery): Promise<MetricsFunnel> {
  return getJson("/metrics/funnel", MetricsFunnelSchema, range);
}

export function fetchTimeseries(
  range: MetricsQuery,
  granularity: TimeseriesGranularity,
  type: EventTypeFilter | "all",
): Promise<MetricsTimeseries> {
  return getJson("/metrics/timeseries", MetricsTimeseriesSchema, {
    ...range,
    granularity,
    type: type === "all" ? undefined : type,
  });
}

export function fetchRoutes(range: MetricsQuery): Promise<MetricsRoutes> {
  return getJson("/metrics/routes", MetricsRoutesSchema, {
    ...range,
    limit: "10",
  });
}

export function fetchHeatmap(range: MetricsQuery): Promise<MetricsHeatmap> {
  return getJson("/metrics/heatmap", MetricsHeatmapSchema, range);
}

export function fetchPipelineHealth(
  range: MetricsQuery,
): Promise<MetricsPipelineHealth> {
  return getJson("/metrics/pipeline-health", MetricsPipelineHealthSchema, range);
}

export const EVENT_TYPE_OPTIONS: Array<EventTypeFilter | "all"> = [
  "all",
  ...EventTypeFilterSchema.options,
];
