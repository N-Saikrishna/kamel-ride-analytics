// Zod-parses simulator env; CLI flags override after parse.

import { z } from "zod";

const envSchema = z.object({
  INGEST_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid simulator environment:\n${details}`);
}

export const env = parsed.data;
