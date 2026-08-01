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
  // Split on statement boundaries — postgres.js extended query runs one statement at a time.
  const statements = body
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await sql.unsafe(statement);
  }
  console.log(`Applied ${file}`);
}

await sql.end({ timeout: 5 });
console.log("Migrations complete.");
