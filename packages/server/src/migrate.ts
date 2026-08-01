// Applies SQL migrations in packages/server/migrations against Neon Postgres.

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "./db.js";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

const files = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const file of files) {
  const path = join(migrationsDir, file);
  const body = await readFile(path, "utf8");
  // Simple query protocol runs the whole file (multiple statements) in one
  // round-trip. Splitting on ';' breaks CREATE TABLE bodies mid-statement.
  // Transaction keeps a half-applied migration from leaving partial DDL.
  await sql.begin(async (tx) => {
    await tx.unsafe(body).simple();
  });
  console.log(`Applied ${file}`);
}

await sql.end({ timeout: 5 });
console.log("Migrations complete.");
