// Intentional malformed payloads for --error-rate (not members of AnyEvent).

import type { Rng } from "./rng.js";
import { pickOne, randomUuid } from "./rng.js";

/** Wire payloads that should fail Zod validation and land in dead_letter_events. */
export type MalformedPayload = Record<string, unknown>;

const MALFORMED_TEMPLATES: ((rng: Rng) => MalformedPayload)[] = [
  // Missing required envelope fields
  (rng) => ({ type: "ride_searched", eventId: randomUuid(rng) }),
  // Unknown event type
  (rng) => ({
    eventId: randomUuid(rng),
    type: "ride_teleported",
    timestamp: new Date().toISOString(),
    userId: "user_bad",
    sessionId: randomUuid(rng),
    schemaVersion: 1,
  }),
  // Wrong schemaVersion
  (rng) => ({
    eventId: randomUuid(rng),
    type: "user_signed_up",
    timestamp: new Date().toISOString(),
    userId: "user_bad",
    sessionId: randomUuid(rng),
    schemaVersion: 99,
    campus: "X",
    referralSource: "organic",
  }),
  // Invalid stars range
  (rng) => ({
    eventId: randomUuid(rng),
    type: "driver_rated",
    timestamp: new Date().toISOString(),
    userId: "user_bad",
    sessionId: randomUuid(rng),
    schemaVersion: 1,
    rideId: randomUuid(rng),
    driverId: "driver_001",
    stars: 9,
  }),
  // Not an object
  () => "not-an-object" as unknown as MalformedPayload,
];

export function makeMalformed(rng: Rng): MalformedPayload {
  return pickOne(rng, MALFORMED_TEMPLATES)(rng);
}
