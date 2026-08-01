// Resolves ?from=&to= into concrete timestamps (default: last 7 days).

import { MetricsRangeQuerySchema } from "@kamel/shared";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type MetricsRange = {
  from: Date;
  to: Date;
};

export function parseMetricsRange(query: unknown): MetricsRange {
  const parsed = MetricsRangeQuerySchema.parse(query);
  const to = parsed.to !== undefined ? new Date(parsed.to) : new Date();
  const from =
    parsed.from !== undefined
      ? new Date(parsed.from)
      : new Date(to.getTime() - SEVEN_DAYS_MS);

  if (from.getTime() > to.getTime()) {
    throw new RangeError("`from` must be <= `to`");
  }

  return { from, to };
}
