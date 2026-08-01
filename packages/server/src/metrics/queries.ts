// Read-only metrics SQL — all aggregation happens in Postgres, not JS.

import type {
  FunnelStepName,
  MetricsFunnel,
  MetricsHeatmap,
  MetricsPipelineHealth,
  MetricsRoutes,
  MetricsSummary,
  MetricsTimeseries,
  TimeseriesGranularity,
} from "@kamel/shared";
import { config } from "../config.js";
import { sql } from "../db.js";
import type { MetricsRange } from "./range.js";

/**
 * KPI rollup for the date range: volume, users/sessions, completed-ride
 * revenue, cancel rate (cancels/requests), and match-latency percentiles.
 * percentile_cont stays in SQL so we don't pull every latency into Node.
 */
export async function querySummary(range: MetricsRange): Promise<MetricsSummary> {
  const rows = await sql<
    {
      total_events: number;
      unique_users: number;
      sessions: number;
      completed_rides: number;
      gross_fare_cents: number;
      cancellation_rate: number;
      match_latency_p50_ms: number | null;
      match_latency_p95_ms: number | null;
    }[]
  >`
    SELECT
      count(*)::int AS total_events,
      count(DISTINCT user_id)::int AS unique_users,
      count(DISTINCT session_id)::int AS sessions,
      count(*) FILTER (WHERE type = 'ride_completed')::int AS completed_rides,
      coalesce(
        sum((properties->>'fareCents')::bigint) FILTER (WHERE type = 'ride_completed'),
        0
      )::int AS gross_fare_cents,
      CASE
        WHEN count(*) FILTER (WHERE type = 'ride_requested') = 0 THEN 0::float8
        ELSE (
          count(*) FILTER (WHERE type = 'ride_cancelled')::float8
          / count(*) FILTER (WHERE type = 'ride_requested')::float8
        )
      END AS cancellation_rate,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY (properties->>'matchLatencyMs')::float8
      ) FILTER (WHERE type = 'ride_matched') AS match_latency_p50_ms,
      percentile_cont(0.95) WITHIN GROUP (
        ORDER BY (properties->>'matchLatencyMs')::float8
      ) FILTER (WHERE type = 'ride_matched') AS match_latency_p95_ms
    FROM events
    WHERE occurred_at >= ${range.from} AND occurred_at <= ${range.to}
  `;

  const row = rows[0];
  if (row === undefined) {
    throw new Error("summary query returned no row");
  }

  return {
    totalEvents: row.total_events,
    uniqueUsers: row.unique_users,
    sessions: row.sessions,
    completedRides: row.completed_rides,
    grossFareCents: row.gross_fare_cents,
    cancellationRate: row.cancellation_rate,
    matchLatencyP50Ms: row.match_latency_p50_ms,
    matchLatencyP95Ms: row.match_latency_p95_ms,
  };
}

/**
 * Session funnel: DISTINCT session_id per step so a session that emits two
 * searches still counts once. Conversions are computed with window functions
 * so the response shape is exact and chart-ready without JS math.
 */
export async function queryFunnel(range: MetricsRange): Promise<MetricsFunnel> {
  const rows = await sql<
    {
      step: FunnelStepName;
      count: number;
      conversion_from_previous: number | null;
      conversion_from_top: number;
    }[]
  >`
    WITH step_counts AS (
      SELECT
        count(DISTINCT session_id) FILTER (WHERE type = 'ride_searched')::int AS ride_searched,
        count(DISTINCT session_id) FILTER (WHERE type = 'ride_requested')::int AS ride_requested,
        count(DISTINCT session_id) FILTER (WHERE type = 'ride_matched')::int AS ride_matched,
        count(DISTINCT session_id) FILTER (WHERE type = 'ride_accepted')::int AS ride_accepted,
        count(DISTINCT session_id) FILTER (WHERE type = 'ride_completed')::int AS ride_completed
      FROM events
      WHERE occurred_at >= ${range.from} AND occurred_at <= ${range.to}
    ),
    ordered AS (
      SELECT * FROM (
        VALUES
          (1, 'ride_searched'::text, (SELECT ride_searched FROM step_counts)),
          (2, 'ride_requested', (SELECT ride_requested FROM step_counts)),
          (3, 'ride_matched', (SELECT ride_matched FROM step_counts)),
          (4, 'ride_accepted', (SELECT ride_accepted FROM step_counts)),
          (5, 'ride_completed', (SELECT ride_completed FROM step_counts))
      ) AS t(ord, step, count)
    )
    SELECT
      step,
      count,
      CASE
        WHEN ord = 1 THEN NULL
        WHEN lag(count) OVER (ORDER BY ord) = 0 THEN NULL
        ELSE count::float8 / lag(count) OVER (ORDER BY ord)
      END AS conversion_from_previous,
      CASE
        WHEN first_value(count) OVER (ORDER BY ord) = 0 THEN 0::float8
        ELSE count::float8 / first_value(count) OVER (ORDER BY ord)
      END AS conversion_from_top
    FROM ordered
    ORDER BY ord
  `;

  return {
    steps: rows.map((row) => ({
      step: row.step,
      count: row.count,
      conversionFromPrevious: row.conversion_from_previous,
      conversionFromTop: row.conversion_from_top,
    })),
  };
}

/**
 * Bucketed event volume with generate_series gap-fill so empty hours/days
 * appear as count=0 (Recharts line charts need contiguous buckets).
 *
 * Analytics bucketing must use the campus business timezone, not UTC: riders
 * experience "Tuesday" and "8am rush" in local wall time. UTC day/hour cuts
 * shift those peaks (ET morning rush lands near noon UTC) and split a single
 * campus evening across two UTC dates. We truncate in CAMPUS_TIMEZONE, then
 * convert the bucket bound back to timestamptz so the UI gets an absolute
 * instant plus the timezone string for axis labels.
 */
export async function queryTimeseries(
  range: MetricsRange,
  granularity: TimeseriesGranularity,
  type: string | undefined,
): Promise<MetricsTimeseries> {
  const tz = config.CAMPUS_TIMEZONE;
  const rows =
    granularity === "hour"
      ? await sql<{ bucket: Date; count: number }[]>`
          WITH buckets AS (
            SELECT generate_series(
              date_trunc('hour', ${range.from} AT TIME ZONE ${tz}),
              date_trunc('hour', ${range.to} AT TIME ZONE ${tz}),
              interval '1 hour'
            ) AS bucket_local
          ),
          counts AS (
            SELECT
              date_trunc('hour', occurred_at AT TIME ZONE ${tz}) AS bucket_local,
              count(*)::int AS count
            FROM events
            WHERE occurred_at >= ${range.from}
              AND occurred_at <= ${range.to}
              AND (${type ?? null}::text IS NULL OR type = ${type ?? null})
            GROUP BY 1
          )
          SELECT
            (b.bucket_local AT TIME ZONE ${tz}) AS bucket,
            coalesce(c.count, 0)::int AS count
          FROM buckets b
          LEFT JOIN counts c ON c.bucket_local = b.bucket_local
          ORDER BY b.bucket_local
        `
      : await sql<{ bucket: Date; count: number }[]>`
          WITH buckets AS (
            SELECT generate_series(
              date_trunc('day', ${range.from} AT TIME ZONE ${tz}),
              date_trunc('day', ${range.to} AT TIME ZONE ${tz}),
              interval '1 day'
            ) AS bucket_local
          ),
          counts AS (
            SELECT
              date_trunc('day', occurred_at AT TIME ZONE ${tz}) AS bucket_local,
              count(*)::int AS count
            FROM events
            WHERE occurred_at >= ${range.from}
              AND occurred_at <= ${range.to}
              AND (${type ?? null}::text IS NULL OR type = ${type ?? null})
            GROUP BY 1
          )
          SELECT
            (b.bucket_local AT TIME ZONE ${tz}) AS bucket,
            coalesce(c.count, 0)::int AS count
          FROM buckets b
          LEFT JOIN counts c ON c.bucket_local = b.bucket_local
          ORDER BY b.bucket_local
        `;

  return {
    granularity,
    timezone: tz,
    points: rows.map((row) => ({
      bucket: new Date(row.bucket).toISOString(),
      count: row.count,
    })),
  };
}

/**
 * Top O/D corridors from completed rides. Origin/destination live on
 * ride_requested.properties; we join to ride_completed on properties.rideId
 * so fares/durations come from the completion event in-range.
 */
export async function queryRoutes(
  range: MetricsRange,
  limit: number,
): Promise<MetricsRoutes> {
  const rows = await sql<
    {
      origin: string;
      destination: string;
      ride_count: number;
      avg_fare_cents: number;
      avg_duration_min: number;
    }[]
  >`
    SELECT
      req.properties->>'origin' AS origin,
      req.properties->>'destination' AS destination,
      count(*)::int AS ride_count,
      round(avg((comp.properties->>'fareCents')::numeric))::int AS avg_fare_cents,
      avg((comp.properties->>'durationMin')::float8)::float8 AS avg_duration_min
    FROM events AS comp
    INNER JOIN events AS req
      ON req.type = 'ride_requested'
      AND req.properties->>'rideId' = comp.properties->>'rideId'
    WHERE comp.type = 'ride_completed'
      AND comp.occurred_at >= ${range.from}
      AND comp.occurred_at <= ${range.to}
    GROUP BY 1, 2
    ORDER BY ride_count DESC, origin ASC, destination ASC
    LIMIT ${limit}
  `;

  return {
    routes: rows.map((row) => ({
      origin: row.origin,
      destination: row.destination,
      rideCount: row.ride_count,
      avgFareCents: row.avg_fare_cents,
      avgDurationMin: row.avg_duration_min,
    })),
  };
}

/**
 * Full 7×24 grid of event density by campus-local DOW/hour.
 * generate_series fills empty cells with 0 so a heatmap never has missing squares.
 *
 * Same business-timezone rationale as timeseries: extract(hour/dow) on raw
 * timestamptz is UTC, which shifts the simulator's 8am/5pm ET peaks to 12/21.
 * `occurred_at AT TIME ZONE tz` yields local wall time before extract.
 */
export async function queryHeatmap(range: MetricsRange): Promise<MetricsHeatmap> {
  const tz = config.CAMPUS_TIMEZONE;
  const rows = await sql<
    { day_of_week: number; hour: number; count: number }[]
  >`
    WITH grid AS (
      SELECT d::int AS day_of_week, h::int AS hour
      FROM generate_series(0, 6) AS d
      CROSS JOIN generate_series(0, 23) AS h
    ),
    counts AS (
      SELECT
        extract(dow FROM occurred_at AT TIME ZONE ${tz})::int AS day_of_week,
        extract(hour FROM occurred_at AT TIME ZONE ${tz})::int AS hour,
        count(*)::int AS count
      FROM events
      WHERE occurred_at >= ${range.from} AND occurred_at <= ${range.to}
      GROUP BY 1, 2
    )
    SELECT
      g.day_of_week,
      g.hour,
      coalesce(c.count, 0)::int AS count
    FROM grid g
    LEFT JOIN counts c
      ON c.day_of_week = g.day_of_week AND c.hour = g.hour
    ORDER BY g.day_of_week, g.hour
  `;

  return {
    timezone: tz,
    cells: rows.map((row) => ({
      dayOfWeek: row.day_of_week,
      hour: row.hour,
      count: row.count,
    })),
  };
}

/**
 * Ingest pipeline health: accepted events vs dead-letters in range, plus the
 * five newest dead-letter rows so operators can see current Zod failures.
 */
export async function queryPipelineHealth(
  range: MetricsRange,
): Promise<MetricsPipelineHealth> {
  const rows = await sql<
    {
      accepted_count: number;
      dead_letter_count: number;
      recent: { id: number; errors: unknown; receivedAt: string }[] | null;
    }[]
  >`
    WITH accepted AS (
      SELECT count(*)::int AS n
      FROM events
      WHERE received_at >= ${range.from} AND received_at <= ${range.to}
    ),
    dead AS (
      SELECT count(*)::int AS n
      FROM dead_letter_events
      WHERE received_at >= ${range.from} AND received_at <= ${range.to}
    ),
    recent AS (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'errors', errors,
            'receivedAt', received_at
          )
          ORDER BY received_at DESC, id DESC
        ),
        '[]'::jsonb
      ) AS items
      FROM (
        SELECT id, errors, received_at
        FROM dead_letter_events
        WHERE received_at >= ${range.from} AND received_at <= ${range.to}
        ORDER BY received_at DESC, id DESC
        LIMIT 5
      ) AS newest
    )
    SELECT
      (SELECT n FROM accepted) AS accepted_count,
      (SELECT n FROM dead) AS dead_letter_count,
      (SELECT items FROM recent) AS recent
  `;

  const row = rows[0];
  if (row === undefined) {
    throw new Error("pipeline-health query returned no row");
  }

  const recent = row.recent ?? [];

  return {
    acceptedCount: row.accepted_count,
    deadLetterCount: row.dead_letter_count,
    recentDeadLetters: recent.map((item) => ({
      id: Number(item.id),
      errors: item.errors,
      receivedAt: new Date(item.receivedAt).toISOString(),
    })),
  };
}
