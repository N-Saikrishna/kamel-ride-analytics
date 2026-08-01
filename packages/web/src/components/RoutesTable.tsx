// Top origin→destination corridors by completed rides.

import type { ReactNode } from "react";
import type { MetricsRoutes } from "@kamel/shared";
import { formatCount, formatDollars } from "../format.js";
import { EmptyState, Panel, Skeleton } from "./Panel.js";

export function RoutesTable(props: {
  loading: boolean;
  routes: MetricsRoutes | null;
}): ReactNode {
  if (props.loading && props.routes === null) {
    return (
      <Panel title="Top routes">
        <Skeleton className="skeleton-chart" />
      </Panel>
    );
  }

  const rows = props.routes?.routes ?? [];
  if (rows.length === 0) {
    return (
      <Panel title="Top routes">
        <EmptyState message="No completed rides with route pairs in this range." />
      </Panel>
    );
  }

  return (
    <Panel title="Top routes">
      <div className="table-wrap">
        <table className="routes">
          <thead>
            <tr>
              <th>Origin</th>
              <th>Destination</th>
              <th>Rides</th>
              <th>Avg fare</th>
              <th>Avg min</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.origin}->${row.destination}`}>
                <td>{row.origin}</td>
                <td>{row.destination}</td>
                <td className="num">{formatCount(row.rideCount)}</td>
                <td className="num">{formatDollars(Math.round(row.avgFareCents))}</td>
                <td className="num">{row.avgDurationMin.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
