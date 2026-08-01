// Session funnel with drop-off % labeled between consecutive steps.

import type { ReactNode } from "react";
import type { MetricsFunnel } from "@kamel/shared";
import { formatCount, formatDropOff, shortStepLabel } from "../format.js";
import { EmptyState, Panel, Skeleton } from "./Panel.js";

export function FunnelChart(props: {
  loading: boolean;
  funnel: MetricsFunnel | null;
}): ReactNode {
  if (props.loading && props.funnel === null) {
    return (
      <Panel title="Funnel">
        <Skeleton className="skeleton-chart" />
      </Panel>
    );
  }

  const steps = props.funnel?.steps ?? [];
  const top = steps[0]?.count ?? 0;

  if (top === 0) {
    return (
      <Panel title="Funnel">
        <EmptyState message="No funnel sessions in this range." />
      </Panel>
    );
  }

  return (
    <Panel title="Funnel">
      {steps.map((step, index) => {
        const widthPct = top === 0 ? 0 : (step.count / top) * 100;
        const prev = index > 0 ? steps[index - 1] : undefined;
        const dropLabel =
          prev !== undefined ? formatDropOff(step.conversionFromPrevious) : "";

        return (
          <div key={step.step}>
            {dropLabel !== "" ? (
              <div className="funnel-drop">{dropLabel} drop-off</div>
            ) : null}
            <div className="funnel-row">
              <div className="funnel-label">{shortStepLabel(step.step)}</div>
              <div className="funnel-track">
                <div
                  className="funnel-fill"
                  style={{ width: `${Math.max(widthPct, 2)}%` }}
                />
              </div>
              <div className="funnel-count">{formatCount(step.count)}</div>
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
