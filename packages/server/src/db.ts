// Pooled Neon Postgres client via postgres.js — safe to import from serverless handlers.

import postgres from "postgres";
import { config } from "./config.js";

/**
 * max: 1 keeps each Vercel isolate from opening a large pool against Neon's
 * connection limit. prepare: false avoids named-prepared-statement conflicts
 * across pooled connections (Neon recommendation for serverless).
 */
export const sql = postgres(config.DATABASE_URL, {
  max: 1,
  prepare: false,
  ssl: "require",
});
