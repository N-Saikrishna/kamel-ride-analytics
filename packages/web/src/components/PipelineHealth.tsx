// Pipeline health — accepted vs dead-letter counts and recent Zod failures.

import type { ReactNode } from "react";
import type { MetricsPipelineHealth } from "@kamel/shared";
import { formatCount } from "../format.js";
import { EmptyState, Panel, Skeleton } from "./Panel.js";

export function PipelineHealth(props: {
  loading: boolean;
  pipeline: MetricsPipelineHealth | null;
}): ReactNode {
  if (props.loading && props.pipeline === null) {
    return (
      <Panel title="Pipeline health">
        <Skeleton className="skeleton-chart" />
      </Panel>
    );
  }

  if (props.pipeline === null) {
    return (
      <Panel title="Pipeline health">
        <EmptyState message="Pipeline metrics unavailable." />
      </Panel>
    );
  }

  const { acceptedCount, deadLetterCount, recentDeadLetters } = props.pipeline;
  const empty = acceptedCount === 0 && deadLetterCount === 0;

  return (
    <Panel title="Pipeline health">
      {empty ? (
        <EmptyState message="No accepted or dead-lettered events in this range." />
      ) : (
        <>
          <div className="pipeline-counts">
            <div>
              <div className="stat-label">Accepted</div>
              <strong>{formatCount(acceptedCount)}</strong>
            </div>
            <div>
              <div className="stat-label">Dead-lettered</div>
              <strong style={{ color: deadLetterCount > 0 ? "var(--danger)" : undefined }}>
                {formatCount(deadLetterCount)}
              </strong>
            </div>
          </div>
          {recentDeadLetters.length === 0 ? (
            <div className="empty">No recent rejections.</div>
          ) : (
            <ul className="dead-list">
              {recentDeadLetters.map((item) => (
                <li key={item.id} className="dead-item">
                  <time dateTime={item.receivedAt}>
                    #{item.id} · {new Date(item.receivedAt).toLocaleString()}
                  </time>
                  <pre>{formatErrors(item.errors)}</pre>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}

function formatErrors(errors: unknown): string {
  try {
    return JSON.stringify(errors, null, 2);
  } catch {
    return String(errors);
  }
}
