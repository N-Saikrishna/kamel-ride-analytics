// Insert validated events and dead-letter invalid payloads.

import type { AnyEvent } from "@kamel/shared";
import type { ZodIssue } from "zod";
import { sql } from "./db.js";
import { toEventRow, type EventRow } from "./events-repo.js";

/** Round-trip through JSON so unknown payloads are safe for jsonb without `any`. */
function toJsonb(value: unknown): ReturnType<typeof sql.json> {
  return sql.json(JSON.parse(JSON.stringify(value ?? null)) as never);
}

export async function insertEvent(
  event: AnyEvent,
): Promise<{ duplicate: boolean }> {
  const row = toEventRow(event);
  const inserted = await sql<{ id: string }[]>`
    INSERT INTO events (
      id, type, user_id, session_id, occurred_at, schema_version, properties
    ) VALUES (
      ${row.id},
      ${row.type},
      ${row.userId},
      ${row.sessionId},
      ${row.occurredAt},
      ${row.schemaVersion},
      ${toJsonb(row.properties)}
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  // No RETURNING row means the PK already existed — treat as idempotent replay.
  return { duplicate: inserted.length === 0 };
}

/**
 * Multi-row insert in one statement. Duplicates are counted by comparing
 * attempted ids against RETURNING ids (ON CONFLICT DO NOTHING skips them).
 */
export async function insertEvents(
  events: AnyEvent[],
): Promise<{ inserted: number; duplicates: number }> {
  if (events.length === 0) {
    return { inserted: 0, duplicates: 0 };
  }

  const rows: EventRow[] = events.map(toEventRow);
  const values = rows.map((row) => ({
    id: row.id,
    type: row.type,
    user_id: row.userId,
    session_id: row.sessionId,
    occurred_at: row.occurredAt,
    schema_version: row.schemaVersion,
    properties: toJsonb(row.properties),
  }));

  const insertedRows = await sql<{ id: string }[]>`
    INSERT INTO events ${sql(values)}
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  const duplicates = rows.length - insertedRows.length;
  return { inserted: insertedRows.length, duplicates };
}

export async function deadLetter(
  raw: unknown,
  errors: ZodIssue[],
): Promise<void> {
  await sql`
    INSERT INTO dead_letter_events (raw, errors)
    VALUES (${toJsonb(raw)}, ${toJsonb(errors)})
  `;
}
