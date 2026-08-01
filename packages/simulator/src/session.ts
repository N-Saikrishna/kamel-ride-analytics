// Coherent ride-session state machine with per-stage funnel drop-off.

import type { AnyEvent } from "@kamel/shared";
import {
  durationMinFromDistance,
  fareCentsFromDistance,
  ROUTES,
} from "./locations.js";
import {
  driverRated,
  messageSent,
  postCreated,
  rideAccepted,
  rideCancelled,
  rideCompleted,
  rideMatched,
  rideRequested,
  rideSearched,
  userSignedUp,
} from "./events.js";
import type { Rng } from "./rng.js";
import {
  intBetween,
  logNormal,
  pickOne,
  pickWeighted,
  randomUuid,
} from "./rng.js";
import { advanceClock, pickSessionStart, toIso } from "./time.js";

const CAMPUSES = ["State U", "Tech College", "River City U", "Hillside College"] as const;
const REFERRALS = ["organic", "friend", "instagram", "orientation", "flyer"] as const;
const CANCEL_REASONS = [
  "changed_plans",
  "found_other_ride",
  "too_long_wait",
  "driver_no_show",
  "wrong_route",
] as const;
const POST_KINDS = ["ride_offer", "ride_request", "social"] as const;

/** Share of sessions that search then leave without requesting (no cancel event). */
const SEARCH_ABANDON_RATE = 0.25;
/**
 * Cancel before match, as a fraction of requested rides.
 * Combined with post-match driver cancels + post-accept cancels ≈ 18% of requested.
 */
const CANCEL_BEFORE_MATCH_RATE = 0.1;
/** Of matched rides, share that never reach ride_accepted. */
const MATCH_NO_ACCEPT_RATE = 0.08;
/** Of no-accept matches: emit ride_cancelled(driver) vs silent timeout abandon. */
const NO_ACCEPT_DRIVER_CANCEL_SHARE = 0.5;
/** Cancel after accept, as a fraction of accepted rides (~5% → keeps total cancel ~18%). */
const CANCEL_AFTER_ACCEPT_RATE = 0.05;
/** Of completed rides, share that also emit driver_rated. */
const RATE_AFTER_COMPLETE = 0.7;
/** New-user sessions that emit user_signed_up first. */
const SIGNUP_RATE = 0.28;
/** Chance to sprinkle a social event between ride steps. */
const SOCIAL_SPRINKLE_RATE = 0.22;

const DRIVERS = Array.from({ length: 40 }, (_, i) => `driver_${String(i + 1).padStart(3, "0")}`);
const USERS = Array.from({ length: 200 }, (_, i) => `user_${String(i + 1).padStart(4, "0")}`);

// ln(45) → lognormal median match latency ≈ 45s; sigma keeps most matches in ~15s–2min.
const MATCH_LATENCY_MU = Math.log(45);
const MATCH_LATENCY_SIGMA = 0.55;

export type SessionOptions = {
  rng: Rng;
  days: number;
  nowMs: number;
};

/**
 * Walk one rider session through the state machine.
 * Abandonment = session ends with no further events.
 * Cancellation = emits ride_cancelled (and never completes).
 */
export function generateSession(opts: SessionOptions): AnyEvent[] {
  const { rng, days, nowMs } = opts;
  const events: AnyEvent[] = [];
  const start = pickSessionStart(rng, days, nowMs);
  const clock = { ms: start.getTime() };
  const userId = pickOne(rng, USERS);
  const sessionId = randomUuid(rng);

  const envelope = (timestamp: string) => ({
    eventId: randomUuid(rng),
    timestamp,
    userId,
    sessionId,
  });

  const maybeSocial = () => {
    if (rng() > SOCIAL_SPRINKLE_RATE) {
      return;
    }
    const ts = advanceClock(rng, clock, 5, 90);
    if (rng() < 0.5) {
      events.push(
        postCreated(envelope(ts), {
          postId: randomUuid(rng),
          kind: pickOne(rng, POST_KINDS),
        }),
      );
    } else {
      events.push(
        messageSent(envelope(ts), {
          threadId: randomUuid(rng),
          recipientId: pickOne(rng, USERS.filter((u) => u !== userId)),
        }),
      );
    }
  };

  // signed_up?
  if (rng() < SIGNUP_RATE) {
    events.push(
      userSignedUp(envelope(toIso(new Date(clock.ms))), {
        campus: pickOne(rng, CAMPUSES),
        referralSource: pickOne(rng, REFERRALS),
      }),
    );
    advanceClock(rng, clock, 30, 300);
  }

  const route = pickWeighted(rng, ROUTES, (r) => r.weight);
  const departAtMs = clock.ms + intBetween(rng, 10, 45) * 60_000;
  const departAt = toIso(new Date(departAtMs));

  // ride_searched
  events.push(
    rideSearched(envelope(toIso(new Date(clock.ms))), {
      origin: route.origin,
      destination: route.destination,
      departAt,
    }),
  );
  maybeSocial();

  // Browse-and-bail: search without ever requesting — abandon, not cancel.
  if (rng() < SEARCH_ABANDON_RATE) {
    return events;
  }

  // ride_requested
  const requestTs = advanceClock(rng, clock, 15, 180);
  const rideId = randomUuid(rng);
  events.push(
    rideRequested(envelope(requestTs), {
      rideId,
      origin: route.origin,
      destination: route.destination,
      seatsWanted: intBetween(rng, 1, 3),
    }),
  );
  maybeSocial();

  // Cancel before match (explicit cancel event).
  if (rng() < CANCEL_BEFORE_MATCH_RATE) {
    const cancelTs = advanceClock(rng, clock, 20, 240);
    events.push(
      rideCancelled(envelope(cancelTs), {
        rideId,
        cancelledBy: "rider",
        reason: pickOne(rng, CANCEL_REASONS),
      }),
    );
    return events;
  }

  // ride_matched
  const matchLatencyMs = Math.round(
    logNormal(rng, MATCH_LATENCY_MU, MATCH_LATENCY_SIGMA) * 1000,
  );
  const matchTs = advanceClock(rng, clock, matchLatencyMs / 1000, matchLatencyMs / 1000 + 5);
  const driverId = pickOne(rng, DRIVERS);
  events.push(
    rideMatched(envelope(matchTs), {
      rideId,
      driverId,
      matchLatencyMs,
    }),
  );
  maybeSocial();

  // Matched but never accepted: driver cancel XOR silent match timeout.
  if (rng() < MATCH_NO_ACCEPT_RATE) {
    if (rng() < NO_ACCEPT_DRIVER_CANCEL_SHARE) {
      const cancelTs = advanceClock(rng, clock, 30, 180);
      events.push(
        rideCancelled(envelope(cancelTs), {
          rideId,
          cancelledBy: "driver",
          reason: pickOne(rng, CANCEL_REASONS),
        }),
      );
    }
    // else: match times out — abandon with no further events.
    return events;
  }

  // ride_accepted
  const acceptTs = advanceClock(rng, clock, 5, 60);
  events.push(
    rideAccepted(envelope(acceptTs), {
      rideId,
      driverId,
    }),
  );
  maybeSocial();

  // Cancel after accept.
  if (rng() < CANCEL_AFTER_ACCEPT_RATE) {
    const cancelTs = advanceClock(rng, clock, 30, 400);
    events.push(
      rideCancelled(envelope(cancelTs), {
        rideId,
        cancelledBy: rng() < 0.65 ? "rider" : "driver",
        reason: pickOne(rng, CANCEL_REASONS),
      }),
    );
    return events;
  }

  // ride_completed → maybe driver_rated
  const tripSec = durationMinFromDistance(route.distanceMi) * 60;
  const completeTs = advanceClock(rng, clock, tripSec * 0.8, tripSec * 1.2);
  events.push(
    rideCompleted(envelope(completeTs), {
      rideId,
      durationMin: durationMinFromDistance(route.distanceMi),
      distanceMi: route.distanceMi,
      fareCents: fareCentsFromDistance(route.distanceMi),
    }),
  );

  if (rng() >= RATE_AFTER_COMPLETE) {
    return events;
  }

  const rateTs = advanceClock(rng, clock, 20, 300);
  // Stars skewed high — campus rides are usually fine.
  const starsRoll = rng();
  const stars =
    starsRoll < 0.45 ? 5 : starsRoll < 0.75 ? 4 : starsRoll < 0.9 ? 3 : starsRoll < 0.97 ? 2 : 1;
  events.push(
    driverRated(envelope(rateTs), {
      rideId,
      driverId,
      stars,
    }),
  );

  return events;
}

/** Keep generating sessions until at least `target` events are produced. */
export function generateEventsUntil(
  opts: SessionOptions,
  target: number,
): AnyEvent[] {
  const out: AnyEvent[] = [];
  while (out.length < target) {
    out.push(...generateSession(opts));
  }
  return out.slice(0, target);
}
