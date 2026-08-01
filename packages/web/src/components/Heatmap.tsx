// Day-of-week × hour heatmap; axis labeled with API timezone.

import type { ReactNode } from "react";
import type { MetricsHeatmap } from "@kamel/shared";
import { EmptyState, Panel, Skeleton } from "./Panel.js";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Heatmap(props: {
  loading: boolean;
  heatmap: MetricsHeatmap | null;
}): ReactNode {
  if (props.loading && props.heatmap === null) {
    return (
      <Panel title="Activity heatmap">
        <Skeleton className="skeleton-chart" />
      </Panel>
    );
  }

  const cells = props.heatmap?.cells ?? [];
  const max = cells.reduce((m, c) => Math.max(m, c.count), 0);
  if (max === 0) {
    return (
      <Panel title="Activity heatmap">
        <EmptyState message="No activity to plot in this range." />
      </Panel>
    );
  }

  const tz = props.heatmap?.timezone ?? "UTC";
  const lookup = new Map(
    cells.map((c) => [`${c.dayOfWeek}-${c.hour}`, c.count] as const),
  );

  return (
    <Panel title="Activity heatmap">
      <div className="heatmap" role="img" aria-label={`Event heatmap in ${tz}`}>
        <div className="heatmap-corner" />
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={`h-${hour}`} className="heatmap-hour">
            {hour % 3 === 0 ? hour : ""}
          </div>
        ))}
        {DOW.map((label, dow) => (
          <DowRow
            key={label}
            label={label}
            dow={dow}
            max={max}
            lookup={lookup}
          />
        ))}
      </div>
      <div className="heatmap-meta">Hours in {tz}</div>
    </Panel>
  );
}

function DowRow(props: {
  label: string;
  dow: number;
  max: number;
  lookup: Map<string, number>;
}): ReactNode {
  return (
    <>
      <div className="heatmap-dow">{props.label}</div>
      {Array.from({ length: 24 }, (_, hour) => {
        const count = props.lookup.get(`${props.dow}-${hour}`) ?? 0;
        const intensity = props.max === 0 ? 0 : count / props.max;
        return (
          <div
            key={`${props.dow}-${hour}`}
            className="heatmap-cell"
            title={`${props.label} ${hour}:00 — ${count}`}
            style={{
              background: `rgba(61, 186, 160, ${0.08 + intensity * 0.92})`,
            }}
          />
        );
      })}
    </>
  );
}
