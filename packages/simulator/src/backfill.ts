// Backfill mode: generate historical traffic and POST /events/batch with concurrency.

import type { IngestClient } from "./client.js";
import { materializeMix } from "./mix.js";
import type { Rng } from "./rng.js";
import { generateEventsUntil } from "./session.js";

const BATCH_SIZE = 100;
const CONCURRENCY = 4;

export type BackfillOptions = {
  client: IngestClient;
  rng: Rng;
  events: number;
  days: number;
  duplicateRate: number;
  errorRate: number;
};

export async function runBackfill(opts: BackfillOptions): Promise<void> {
  const nowMs = Date.now();
  const clean = generateEventsUntil(
    { rng: opts.rng, days: opts.days, nowMs },
    opts.events,
  );
  const payloads = materializeMix(
    clean,
    opts.rng,
    opts.duplicateRate,
    opts.errorRate,
  );

  const batches: (typeof payloads)[] = [];
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    batches.push(payloads.slice(i, i + BATCH_SIZE));
  }

  let sent = 0;
  let accepted = 0;
  let duplicates = 0;
  let rejected = 0;
  const total = payloads.length;

  const writeProgress = () => {
    const pct = total === 0 ? 100 : Math.floor((sent / total) * 100);
    process.stdout.write(
      `\rbackfill ${sent}/${total} (${pct}%)  accepted=${accepted}  duplicates=${duplicates}  rejected=${rejected}   `,
    );
  };

  writeProgress();

  let next = 0;
  async function worker(): Promise<void> {
    while (next < batches.length) {
      const index = next;
      next += 1;
      const batch = batches[index];
      if (batch === undefined) {
        return;
      }
      const result = await opts.client.postBatch(batch);
      sent += batch.length;
      accepted += result.accepted;
      duplicates += result.duplicates;
      rejected += result.rejected;
      writeProgress();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () =>
      worker(),
    ),
  );

  process.stdout.write("\n");
  console.log(
    `Done. posted=${total} accepted=${accepted} duplicates=${duplicates} rejected=${rejected}`,
  );
}
