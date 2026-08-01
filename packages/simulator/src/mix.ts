// Apply --duplicate-rate / --error-rate transforms over a clean event stream.

import type { AnyEvent } from "@kamel/shared";
import { makeMalformed, type MalformedPayload } from "./malformed.js";
import type { Rng } from "./rng.js";

export type OutboundPayload = AnyEvent | MalformedPayload;

/**
 * Mixes verbatim duplicate resends and malformed payloads into the stream.
 * Duplicates clone a recent valid event so the server can prove ON CONFLICT dedup.
 */
export function* withTrafficMix(
  events: readonly AnyEvent[],
  rng: Rng,
  duplicateRate: number,
  errorRate: number,
): Generator<OutboundPayload> {
  const recent: AnyEvent[] = [];

  for (const event of events) {
    // Error injection replaces this slot rather than appending — keeps --events counts honest.
    if (rng() < errorRate) {
      yield makeMalformed(rng);
      continue;
    }

    yield event;
    recent.push(event);
    if (recent.length > 64) {
      recent.shift();
    }

    if (rng() < duplicateRate && recent.length > 0) {
      const idx = Math.floor(rng() * recent.length);
      const prior = recent[idx];
      if (prior !== undefined) {
        yield prior;
      }
    }
  }
}

export function materializeMix(
  events: readonly AnyEvent[],
  rng: Rng,
  duplicateRate: number,
  errorRate: number,
): OutboundPayload[] {
  return [...withTrafficMix(events, rng, duplicateRate, errorRate)];
}
