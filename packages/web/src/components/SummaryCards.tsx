// Summary KPI cards — fares as dollars, latency as seconds.

import type { ReactNode } from "react";
import type { MetricsSummary } from "@kamel/shared";
import {
  formatCount,
  formatDollars,
  formatPercent,
  formatSeconds,
} from "../format.js";
import { EmptyState, Skeleton } from "./Panel.js";

export function SummaryCards(props: {
  loading: boolean;
  summary: MetricsSummary | null;
}): ReactNode {
  if (props.loading && props.summary === null) {
    return (
      <div className="grid-stats">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="panel stat">
            <Skeleton className="skeleton-block" />
          </div>
        ))}
      </div>
    );
  }

  if (props.summary === null || props.summary.totalEvents === 0) {
    return (
      <div className="panel">
        <EmptyState message="No events in this range yet. Run a backfill or turn on the simulator." />
      </div>
    );
  }

  const s = props.summary;
  const cards = [
    { label: "Total events", value: formatCount(s.totalEvents) },
    { label: "Unique users", value: formatCount(s.uniqueUsers) },
    { label: "Sessions", value: formatCount(s.sessions) },
    { label: "Completed rides", value: formatCount(s.completedRides) },
    { label: "Gross fare", value: formatDollars(s.grossFareCents) },
    { label: "Cancel rate", value: formatPercent(s.cancellationRate) },
    { label: "Match p50", value: formatSeconds(s.matchLatencyP50Ms) },
    { label: "Match p95", value: formatSeconds(s.matchLatencyP95Ms) },
  ];

  return (
    <div className="grid-stats">
      {cards.map((card) => (
        <article key={card.label} className="panel stat">
          <div className="stat-label">{card.label}</div>
          <div className="stat-value">{card.value}</div>
        </article>
      ))}
    </div>
  );
}
