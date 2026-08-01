// Seeded PRNG utilities — mulberry32 + helpers for weighted picks and distributions.

/** Deterministic 32-bit PRNG; same seed → same traffic for reproducible demos. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function floatBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) {
    throw new Error("pickOne called on empty array");
  }
  return item;
}

/** Weighted random choice; weights need not sum to 1. */
export function pickWeighted<T>(
  rng: Rng,
  items: readonly T[],
  weightOf: (item: T) => number,
): T {
  let total = 0;
  for (const item of items) {
    total += weightOf(item);
  }
  let r = rng() * total;
  for (const item of items) {
    r -= weightOf(item);
    if (r <= 0) {
      return item;
    }
  }
  const last = items[items.length - 1];
  if (last === undefined) {
    throw new Error("pickWeighted called on empty array");
  }
  return last;
}

/** Lognormal sample; median = exp(mu). Default mu=ln(45) → median match latency ~45s. */
export function logNormal(rng: Rng, mu: number, sigma: number): number {
  // Box-Muller → standard normal, then exp(mu + sigma * Z).
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + sigma * z);
}

/** UUID v4-shaped id from the seeded RNG (not crypto-random — reproducibility wins). */
export function randomUuid(rng: Rng): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(rng() * 256);
  }
  // Version 4 / IETF variant bits — indices are in-range by construction.
  const b6 = bytes[6] ?? 0;
  const b8 = bytes[8] ?? 0;
  bytes[6] = (b6 & 0x0f) | 0x40;
  bytes[8] = (b8 & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
