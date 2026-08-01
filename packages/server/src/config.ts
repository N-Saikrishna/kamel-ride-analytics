// Zod-parses process.env once at startup; never read process.env elsewhere.

import { z } from "zod";

const envSchema = z.object({
  // Neon pooled URL — host must include -pooler for serverless connection reuse.
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  /**
   * IANA zone for campus-local analytics buckets (heatmap hours, calendar days).
   * Validated via Intl so a typo fails loudly at startup instead of in SQL.
   */
  CAMPUS_TIMEZONE: z
    .string()
    .min(1)
    .default("America/New_York")
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Must be a valid IANA time zone (e.g. America/New_York)" },
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const config = parsed.data;
