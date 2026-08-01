// Shared event envelope, per-type Zod schemas, and a non-throwing parse helper.

import { z } from "zod";

/**
 * Envelope shared by every event. Not used alone for ingest — concrete
 * members below extend it via discriminatedUnion on `type`.
 */
export const BaseEventSchema = z.object({
  // Client-generated UUID — also the idempotency key (events.id PK).
  eventId: z.string().uuid(),
  type: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  schemaVersion: z.literal(1),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

const envelope = BaseEventSchema.omit({ type: true }).shape;

export const UserSignedUpEventSchema = z.object({
  ...envelope,
  type: z.literal("user_signed_up"),
  campus: z.string().min(1),
  referralSource: z.string().min(1),
});

export const RideSearchedEventSchema = z.object({
  ...envelope,
  type: z.literal("ride_searched"),
  origin: z.string().min(1),
  destination: z.string().min(1),
  departAt: z.string().datetime({ offset: true }),
});

export const RideRequestedEventSchema = z.object({
  ...envelope,
  type: z.literal("ride_requested"),
  rideId: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  seatsWanted: z.number().int().positive(),
});

export const RideMatchedEventSchema = z.object({
  ...envelope,
  type: z.literal("ride_matched"),
  rideId: z.string().min(1),
  driverId: z.string().min(1),
  matchLatencyMs: z.number().nonnegative(),
});

export const RideAcceptedEventSchema = z.object({
  ...envelope,
  type: z.literal("ride_accepted"),
  rideId: z.string().min(1),
  driverId: z.string().min(1),
});

export const RideCancelledEventSchema = z.object({
  ...envelope,
  type: z.literal("ride_cancelled"),
  rideId: z.string().min(1),
  cancelledBy: z.enum(["rider", "driver"]),
  reason: z.string().min(1),
});

export const RideCompletedEventSchema = z.object({
  ...envelope,
  type: z.literal("ride_completed"),
  rideId: z.string().min(1),
  durationMin: z.number().nonnegative(),
  distanceMi: z.number().nonnegative(),
  fareCents: z.number().int().nonnegative(),
});

export const DriverRatedEventSchema = z.object({
  ...envelope,
  type: z.literal("driver_rated"),
  rideId: z.string().min(1),
  driverId: z.string().min(1),
  stars: z.number().int().min(1).max(5),
});

export const PostCreatedEventSchema = z.object({
  ...envelope,
  type: z.literal("post_created"),
  postId: z.string().min(1),
  kind: z.enum(["ride_offer", "ride_request", "social"]),
});

export const MessageSentEventSchema = z.object({
  ...envelope,
  type: z.literal("message_sent"),
  threadId: z.string().min(1),
  recipientId: z.string().min(1),
});

/**
 * Discriminated on `type` so consumers get a narrowed object after a
 * successful parse — a plain union of objects would force manual narrowing.
 */
export const AnyEventSchema = z.discriminatedUnion("type", [
  UserSignedUpEventSchema,
  RideSearchedEventSchema,
  RideRequestedEventSchema,
  RideMatchedEventSchema,
  RideAcceptedEventSchema,
  RideCancelledEventSchema,
  RideCompletedEventSchema,
  DriverRatedEventSchema,
  PostCreatedEventSchema,
  MessageSentEventSchema,
]);

export type UserSignedUpEvent = z.infer<typeof UserSignedUpEventSchema>;
export type RideSearchedEvent = z.infer<typeof RideSearchedEventSchema>;
export type RideRequestedEvent = z.infer<typeof RideRequestedEventSchema>;
export type RideMatchedEvent = z.infer<typeof RideMatchedEventSchema>;
export type RideAcceptedEvent = z.infer<typeof RideAcceptedEventSchema>;
export type RideCancelledEvent = z.infer<typeof RideCancelledEventSchema>;
export type RideCompletedEvent = z.infer<typeof RideCompletedEventSchema>;
export type DriverRatedEvent = z.infer<typeof DriverRatedEventSchema>;
export type PostCreatedEvent = z.infer<typeof PostCreatedEventSchema>;
export type MessageSentEvent = z.infer<typeof MessageSentEventSchema>;
export type AnyEvent = z.infer<typeof AnyEventSchema>;

export type ParseEventSuccess = { success: true; data: AnyEvent };
export type ParseEventFailure = {
  success: false;
  errors: z.ZodIssue[];
};
export type ParseEventResult = ParseEventSuccess | ParseEventFailure;

/** Safe parse — returns a result instead of throwing so ingest can dead-letter. */
export function parseEvent(input: unknown): ParseEventResult {
  const result = AnyEventSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}
