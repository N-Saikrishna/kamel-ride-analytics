// Maps a validated AnyEvent into the events-table row shape (envelope cols + properties jsonb).

import type { AnyEvent } from "@kamel/shared";

const ENVELOPE_KEYS = new Set([
  "eventId",
  "type",
  "timestamp",
  "userId",
  "sessionId",
  "schemaVersion",
]);

export type EventRow = {
  id: string;
  type: string;
  userId: string;
  sessionId: string;
  occurredAt: string;
  schemaVersion: number;
  properties: Record<string, unknown>;
};

/** Strip envelope fields so only type-specific payload lands in properties jsonb. */
export function toEventRow(event: AnyEvent): EventRow {
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (!ENVELOPE_KEYS.has(key)) {
      properties[key] = value;
    }
  }

  return {
    id: event.eventId,
    type: event.type,
    userId: event.userId,
    sessionId: event.sessionId,
    occurredAt: event.timestamp,
    schemaVersion: event.schemaVersion,
    properties,
  };
}
