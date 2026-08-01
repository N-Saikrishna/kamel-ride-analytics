// Root dashboard page — range/live controls and metrics panels.

import { useState, type ReactNode } from "react";
import type { TimeseriesGranularity } from "@kamel/shared";
import type { DateRangeKey, EventTypeFilter } from "./api.js";
import { FunnelChart } from "./components/FunnelChart.js";
import { Header } from "./components/Header.js";
import { Heatmap } from "./components/Heatmap.js";
import { PipelineHealth } from "./components/PipelineHealth.js";
import { RoutesTable } from "./components/RoutesTable.js";
import { SummaryCards } from "./components/SummaryCards.js";
import { TimeseriesChart } from "./components/TimeseriesChart.js";
import { useDashboard } from "./useDashboard.js";

export function App(): ReactNode {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("7d");
  const [live, setLive] = useState(false);
  const [granularity, setGranularity] = useState<TimeseriesGranularity>("day");
  const [eventType, setEventType] = useState<EventTypeFilter | "all">("all");

  const state = useDashboard({ rangeKey, live, granularity, eventType });
  const loading = state.status === "loading";
  const data = state.status === "ready" ? state.data : null;

  return (
    <div className="app">
      <Header
        rangeKey={rangeKey}
        live={live}
        onRangeChange={setRangeKey}
        onLiveChange={setLive}
      />

      {state.status === "error" ? (
        <div className="error-banner" role="alert">
          {state.message}
        </div>
      ) : null}

      <SummaryCards loading={loading} summary={data?.summary ?? null} />

      <div className="grid-main">
        <FunnelChart loading={loading} funnel={data?.funnel ?? null} />
        <TimeseriesChart
          loading={loading}
          timeseries={data?.timeseries ?? null}
          granularity={granularity}
          eventType={eventType}
          onGranularityChange={setGranularity}
          onEventTypeChange={setEventType}
        />
      </div>

      <div className="grid-lower">
        <RoutesTable loading={loading} routes={data?.routes ?? null} />
        <Heatmap loading={loading} heatmap={data?.heatmap ?? null} />
      </div>

      <PipelineHealth loading={loading} pipeline={data?.pipeline ?? null} />
    </div>
  );
}
