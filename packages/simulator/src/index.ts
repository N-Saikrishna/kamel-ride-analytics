// Kamel Ride traffic simulator CLI — coherent sessions → ingest API.

import { runBackfill } from "./backfill.js";
import { parseCli } from "./cli.js";
import { IngestClient } from "./client.js";
import { createRng } from "./rng.js";
import { runStream } from "./stream.js";

const opts = parseCli(process.argv.slice(2));
const rng = createRng(opts.seed);
const client = new IngestClient(opts.url);

console.log(
  `simulator mode=${opts.mode} url=${opts.url} seed=${opts.seed} duplicateRate=${opts.duplicateRate} errorRate=${opts.errorRate}`,
);

if (opts.mode === "backfill") {
  console.log(`backfill events=${opts.events} days=${opts.days}`);
  await runBackfill({
    client,
    rng,
    events: opts.events,
    days: opts.days,
    duplicateRate: opts.duplicateRate,
    errorRate: opts.errorRate,
  });
} else {
  console.log(`stream rate=${opts.rate}/s (Ctrl+C to stop)`);
  await runStream({
    client,
    rng,
    rate: opts.rate,
    duplicateRate: opts.duplicateRate,
    errorRate: opts.errorRate,
    days: opts.days,
  });
}
