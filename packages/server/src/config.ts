// Zod-parses process.env once at startup; never read process.env elsewhere.

import { z } from "zod";

const envSchema = z.object({
  // Neon pooled URL — host must include -pooler for serverless connection reuse.
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const config = parsed.data;
