// Loads all dashboard metrics for a range; optional 3s polling while Live is on.

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MetricsFunnel,
  MetricsHeatmap,
  MetricsPipelineHealth,
  MetricsRoutes,
  MetricsSummary,
  MetricsTimeseries,
  TimeseriesGranularity,
} from "@kamel/shared";
import {
  fetchFunnel,
  fetchHeatmap,
  fetchPipelineHealth,
  fetchRoutes,
  fetchSummary,
  fetchTimeseries,
  rangeForKey,
  type DateRangeKey,
  type EventTypeFilter,
} from "./api.js";

export type DashboardData = {
  summary: MetricsSummary;
  funnel: MetricsFunnel;
  timeseries: MetricsTimeseries;
  routes: MetricsRoutes;
  heatmap: MetricsHeatmap;
  pipeline: MetricsPipelineHealth;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

const LIVE_MS = 3_000;

export function useDashboard(opts: {
  rangeKey: DateRangeKey;
  live: boolean;
  granularity: TimeseriesGranularity;
  eventType: EventTypeFilter | "all";
}): LoadState & { refresh: () => void } {
  const { rangeKey, live, granularity, eventType } = opts;
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    // Keep prior data visible during live refreshes — only skeleton on first load.
    setState((prev) =>
      prev.status === "ready" ? prev : { status: "loading" },
    );

    try {
      const range = rangeForKey(rangeKey);
      const [summary, funnel, timeseries, routes, heatmap, pipeline] =
        await Promise.all([
          fetchSummary(range),
          fetchFunnel(range),
          fetchTimeseries(range, granularity, eventType),
          fetchRoutes(range),
          fetchHeatmap(range),
          fetchPipelineHealth(range),
        ]);

      if (id !== requestId.current) {
        return;
      }

      setState({
        status: "ready",
        data: { summary, funnel, timeseries, routes, heatmap, pipeline },
      });
    } catch (error) {
      if (id !== requestId.current) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Failed to load metrics";
      setState({ status: "error", message });
    }
  }, [rangeKey, granularity, eventType]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  // setInterval only while Live is on; clear on toggle-off and unmount.
  useEffect(() => {
    if (!live) {
      return;
    }
    const handle = window.setInterval(() => {
      setTick((n) => n + 1);
    }, LIVE_MS);
    return () => {
      window.clearInterval(handle);
    };
  }, [live]);

  return {
    ...state,
    refresh: () => {
      setTick((n) => n + 1);
    },
  };
}
