// Time-of-day weighting and monotonic session clock helpers.

import type { Rng } from "./rng.js";
import { floatBetween, intBetween, pickWeighted } from "./rng.js";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Dual-peak campus demand: morning class rush (~8am) and evening (~5pm).
 * Overnight keeps a small floor so backfill isn't empty at 3am.
 */
export function hourWeight(hour: number): number {
  const morning = Math.exp(-0.5 * ((hour - 8) / 1.4) ** 2);
  const evening = Math.exp(-0.5 * ((hour - 17) / 1.6) ** 2);
  return 0.06 + morning + evening;
}

/** Pick a Date uniformly in [now - days, now], then bias the hour-of-day. */
export function pickSessionStart(rng: Rng, days: number, nowMs: number): Date {
  const windowMs = days * 24 * 60 * 60 * 1000;
  const dayOffset = rng() * windowMs;
  const raw = new Date(nowMs - dayOffset);
  const hour = pickWeighted(rng, HOURS, hourWeight);
  const minute = intBetween(rng, 0, 59);
  const second = intBetween(rng, 0, 59);
  raw.setHours(hour, minute, second, 0);
  // Clamp into the backfill window if hour rewrite pushed past "now".
  if (raw.getTime() > nowMs) {
    raw.setTime(nowMs - intBetween(rng, 1_000, 60_000));
  }
  return raw;
}

export function toIso(date: Date): string {
  return date.toISOString();
}

/**
 * Advances a mutable clock by a plausible gap (seconds–minutes).
 * Returns the new ISO timestamp for the next event.
 */
export function advanceClock(
  rng: Rng,
  clock: { ms: number },
  minSec: number,
  maxSec: number,
): string {
  const gapMs = floatBetween(rng, minSec, maxSec) * 1000;
  clock.ms += gapMs;
  return toIso(new Date(clock.ms));
}
