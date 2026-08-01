// Stream mode: live traffic paced by a token bucket with a running counter.

import type { AnyEvent } from "@kamel/shared";
import type { IngestClient } from "./client.js";
import { makeMalformed } from "./malformed.js";
import type { Rng } from "./rng.js";
import { generateSession } from "./session.js";

export type StreamOptions = {
  client: IngestClient;
  rng: Rng;
  rate: number;
  duplicateRate: number;
  errorRate: number;
  /** Stream keeps generating indefinitely; days only shapes session start bias near "now". */
  days: number;
};

/**
 * Classic token bucket: refill `rate` tokens/sec up to a small burst capacity.
 * Awaiting take() paces outbound posts without busy-spinning.
 */
class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private readonly ratePerSec: number,
    private readonly capacity: number,
  ) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefillMs) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.ratePerSec,
    );
    this.lastRefillMs = now;
  }

  async take(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const need = (1 - this.tokens) / this.ratePerSec;
      await sleep(Math.max(5, need * 1000));
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runStream(opts: StreamOptions): Promise<void> {
  const bucket = new TokenBucket(opts.rate, Math.max(1, opts.rate));
  const recent: AnyEvent[] = [];
  let queue: AnyEvent[] = [];

  let accepted = 0;
  let duplicates = 0;
  let rejected = 0;
  let sent = 0;

  const writeCounter = () => {
    process.stdout.write(
      `\rstream sent=${sent}  accepted=${accepted}  duplicates=${duplicates}  rejected=${rejected}   `,
    );
  };

  const stop = () => {
    process.stdout.write("\n");
    console.log(
      `Stopped. sent=${sent} accepted=${accepted} duplicates=${duplicates} rejected=${rejected}`,
    );
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  writeCounter();

  for (;;) {
    await bucket.take();

    if (queue.length === 0) {
      queue = generateSession({
        rng: opts.rng,
        days: Math.max(1, opts.days),
        nowMs: Date.now(),
      });
    }

    const nextEvent = queue.shift();
    if (nextEvent === undefined) {
      continue;
    }

    let payload: unknown = nextEvent;

    if (opts.rng() < opts.errorRate) {
      payload = makeMalformed(opts.rng);
    } else {
      recent.push(nextEvent);
      if (recent.length > 64) {
        recent.shift();
      }
      // After a valid send slot, occasionally replay a prior event for dedup demos.
      if (opts.rng() < opts.duplicateRate && recent.length > 1) {
        // Push duplicate onto the front of the queue so the bucket paces it too.
        const idx = Math.floor(opts.rng() * recent.length);
        const prior = recent[idx];
        if (prior !== undefined) {
          queue.unshift(prior);
        }
      }
    }

    const result = await opts.client.postOne(payload);
    sent += 1;
    accepted += result.accepted;
    duplicates += result.duplicates;
    rejected += result.rejected;
    writeCounter();
  }
}
