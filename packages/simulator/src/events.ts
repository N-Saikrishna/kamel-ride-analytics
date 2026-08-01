// Typed event factories — every return value is a member of the shared AnyEvent union.

import type {
  AnyEvent,
  DriverRatedEvent,
  MessageSentEvent,
  PostCreatedEvent,
  RideAcceptedEvent,
  RideCancelledEvent,
  RideCompletedEvent,
  RideMatchedEvent,
  RideRequestedEvent,
  RideSearchedEvent,
  UserSignedUpEvent,
} from "@kamel/shared";

type Envelope = {
  eventId: string;
  timestamp: string;
  userId: string;
  sessionId: string;
};

const SCHEMA = 1 as const;

export function userSignedUp(
  env: Envelope,
  fields: { campus: string; referralSource: string },
): UserSignedUpEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "user_signed_up",
    ...fields,
  };
}

export function rideSearched(
  env: Envelope,
  fields: { origin: string; destination: string; departAt: string },
): RideSearchedEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "ride_searched",
    ...fields,
  };
}

export function rideRequested(
  env: Envelope,
  fields: {
    rideId: string;
    origin: string;
    destination: string;
    seatsWanted: number;
  },
): RideRequestedEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "ride_requested",
    ...fields,
  };
}

export function rideMatched(
  env: Envelope,
  fields: { rideId: string; driverId: string; matchLatencyMs: number },
): RideMatchedEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "ride_matched",
    ...fields,
  };
}

export function rideAccepted(
  env: Envelope,
  fields: { rideId: string; driverId: string },
): RideAcceptedEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "ride_accepted",
    ...fields,
  };
}

export function rideCancelled(
  env: Envelope,
  fields: {
    rideId: string;
    cancelledBy: "rider" | "driver";
    reason: string;
  },
): RideCancelledEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "ride_cancelled",
    ...fields,
  };
}

export function rideCompleted(
  env: Envelope,
  fields: {
    rideId: string;
    durationMin: number;
    distanceMi: number;
    fareCents: number;
  },
): RideCompletedEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "ride_completed",
    ...fields,
  };
}

export function driverRated(
  env: Envelope,
  fields: { rideId: string; driverId: string; stars: number },
): DriverRatedEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "driver_rated",
    ...fields,
  };
}

export function postCreated(
  env: Envelope,
  fields: { postId: string; kind: "ride_offer" | "ride_request" | "social" },
): PostCreatedEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "post_created",
    ...fields,
  };
}

export function messageSent(
  env: Envelope,
  fields: { threadId: string; recipientId: string },
): MessageSentEvent {
  return {
    ...env,
    schemaVersion: SCHEMA,
    type: "message_sent",
    ...fields,
  };
}

/** Compile-time check that factories only produce shared-union members. */
export type BuiltEvent = ReturnType<
  | typeof userSignedUp
  | typeof rideSearched
  | typeof rideRequested
  | typeof rideMatched
  | typeof rideAccepted
  | typeof rideCancelled
  | typeof rideCompleted
  | typeof driverRated
  | typeof postCreated
  | typeof messageSent
>;

const _assertBuiltEventIsAnyEvent: BuiltEvent extends AnyEvent ? true : false =
  true;
void _assertBuiltEventIsAnyEvent;
