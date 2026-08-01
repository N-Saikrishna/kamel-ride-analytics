// Metrics API query/response schemas — shared by server and (later) web.

import { z } from "zod";

/** Accepts full ISO datetimes or date-only (YYYY-MM-DD); refined via Date.parse. */
export const IsoDateParamSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a valid ISO date or datetime",
  });

export const MetricsRangeQuerySchema = z.object({
  from: IsoDateParamSchema.optional(),
  to: IsoDateParamSchema.optional(),
});

export type MetricsRangeQuery = z.infer<typeof MetricsRangeQuerySchema>;

export const MetricsSummarySchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  uniqueUsers: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  completedRides: z.number().int().nonnegative(),
  grossFareCents: z.number().int().nonnegative(),
  /** ride_cancelled / ride_requested; 0 when no requests in range. */
  cancellationRate: z.number().nonnegative(),
  /** Null when no ride_matched events in range. */
  matchLatencyP50Ms: z.number().nonnegative().nullable(),
  matchLatencyP95Ms: z.number().nonnegative().nullable(),
});

export type MetricsSummary = z.infer<typeof MetricsSummarySchema>;

export const FunnelStepNameSchema = z.enum([
  "ride_searched",
  "ride_requested",
  "ride_matched",
  "ride_accepted",
  "ride_completed",
]);

export type FunnelStepName = z.infer<typeof FunnelStepNameSchema>;

export const FunnelStepSchema = z.object({
  step: FunnelStepNameSchema,
  count: z.number().int().nonnegative(),
  /** Null for the top step (no previous). */
  conversionFromPrevious: z.number().nonnegative().nullable(),
  conversionFromTop: z.number().nonnegative(),
});

export type FunnelStep = z.infer<typeof FunnelStepSchema>;

export const MetricsFunnelSchema = z.object({
  steps: z.array(FunnelStepSchema),
});

export type MetricsFunnel = z.infer<typeof MetricsFunnelSchema>;

export const TimeseriesGranularitySchema = z.enum(["hour", "day"]);

export type TimeseriesGranularity = z.infer<typeof TimeseriesGranularitySchema>;

/** Optional type filter — must be a known analytics event type when present. */
export const EventTypeFilterSchema = z.enum([
  "user_signed_up",
  "ride_searched",
  "ride_requested",
  "ride_matched",
  "ride_accepted",
  "ride_cancelled",
  "ride_completed",
  "driver_rated",
  "post_created",
  "message_sent",
]);

export const MetricsTimeseriesQuerySchema = MetricsRangeQuerySchema.extend({
  granularity: TimeseriesGranularitySchema.default("day"),
  type: EventTypeFilterSchema.optional(),
});

export type MetricsTimeseriesQuery = z.infer<typeof MetricsTimeseriesQuerySchema>;

export const TimeseriesPointSchema = z.object({
  bucket: z.string(),
  count: z.number().int().nonnegative(),
});

export type TimeseriesPoint = z.infer<typeof TimeseriesPointSchema>;

export const MetricsTimeseriesSchema = z.object({
  granularity: TimeseriesGranularitySchema,
  /** IANA zone used for day/hour bucket boundaries (campus-local, not UTC). */
  timezone: z.string().min(1),
  points: z.array(TimeseriesPointSchema),
});

export type MetricsTimeseries = z.infer<typeof MetricsTimeseriesSchema>;

export const MetricsRoutesQuerySchema = MetricsRangeQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type MetricsRoutesQuery = z.infer<typeof MetricsRoutesQuerySchema>;

export const RouteStatSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  rideCount: z.number().int().nonnegative(),
  avgFareCents: z.number().nonnegative(),
  avgDurationMin: z.number().nonnegative(),
});

export type RouteStat = z.infer<typeof RouteStatSchema>;

export const MetricsRoutesSchema = z.object({
  routes: z.array(RouteStatSchema),
});

export type MetricsRoutes = z.infer<typeof MetricsRoutesSchema>;

export const HeatmapCellSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  count: z.number().int().nonnegative(),
});

export type HeatmapCell = z.infer<typeof HeatmapCellSchema>;

export const MetricsHeatmapSchema = z.object({
  /** IANA zone used when extracting day-of-week / hour-of-day. */
  timezone: z.string().min(1),
  cells: z.array(HeatmapCellSchema),
});

export type MetricsHeatmap = z.infer<typeof MetricsHeatmapSchema>;

export const DeadLetterItemSchema = z.object({
  id: z.number().int(),
  errors: z.unknown(),
  receivedAt: z.string(),
});

export type DeadLetterItem = z.infer<typeof DeadLetterItemSchema>;

export const MetricsPipelineHealthSchema = z.object({
  acceptedCount: z.number().int().nonnegative(),
  deadLetterCount: z.number().int().nonnegative(),
  recentDeadLetters: z.array(DeadLetterItemSchema),
});

export type MetricsPipelineHealth = z.infer<typeof MetricsPipelineHealthSchema>;
