// CLI flag parsing for the traffic simulator.

import { parseArgs } from "node:util";
import { z } from "zod";
import { env } from "./config.js";

const cliSchema = z.object({
  url: z.string().url(),
  mode: z.enum(["backfill", "stream"]),
  events: z.number().int().positive(),
  days: z.number().int().positive(),
  rate: z.number().positive(),
  duplicateRate: z.number().min(0).max(1),
  errorRate: z.number().min(0).max(1),
  seed: z.number().int(),
});

export type CliOptions = z.infer<typeof cliSchema>;

export function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: "string" },
      mode: { type: "string" },
      events: { type: "string" },
      days: { type: "string" },
      rate: { type: "string" },
      "duplicate-rate": { type: "string" },
      "error-rate": { type: "string" },
      seed: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const raw = {
    url: values.url ?? env.INGEST_URL,
    mode: values.mode ?? "backfill",
    events: Number(values.events ?? "5000"),
    days: Number(values.days ?? "7"),
    rate: Number(values.rate ?? "10"),
    duplicateRate: Number(values["duplicate-rate"] ?? "0"),
    errorRate: Number(values["error-rate"] ?? "0"),
    seed: Number(values.seed ?? "42"),
  };

  const parsed = cliSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(`Invalid CLI flags:\n${details}`);
    printHelp();
    process.exit(1);
  }

  return parsed.data;
}

function printHelp(): void {
  console.log(`Usage: simulate --mode backfill|stream [options]

Options:
  --url <url>              Ingest base URL (default: INGEST_URL or http://localhost:3000)
  --mode backfill|stream   backfill historical batches, or live stream
  --events <n>             backfill: total events to generate (default: 5000)
  --days <n>               backfill: spread over past N days (default: 7)
  --rate <n>               stream: events per second (default: 10)
  --duplicate-rate <0-1>   fraction of verbatim resends to prove dedup (default: 0)
  --error-rate <0-1>       fraction of malformed events (default: 0)
  --seed <n>               deterministic RNG seed (default: 42)
  -h, --help               show this help
`);
}
