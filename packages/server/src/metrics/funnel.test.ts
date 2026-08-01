// Integration test: funnel conversions for a known set of sessions.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { sql } from "../db.js";
import { queryFunnel } from "./queries.js";

/** Isolated historical window so simulator traffic cannot pollute assertions. */
const FROM = new Date("1999-06-01T00:00:00.000Z");
const TO = new Date("1999-06-07T23:59:59.999Z");

type Step =
  | "ride_searched"
  | "ride_requested"
  | "ride_matched"
  | "ride_accepted"
  | "ride_completed";

const FUNNEL_PREFIX = "funnel_test_";

async function insertEvent(input: {
  sessionId: string;
  type: Step;
  occurredAt: string;
  rideId?: string;
}): Promise<void> {
  const properties =
    input.rideId === undefined
      ? {}
      : input.type === "ride_searched"
        ? { origin: "A", destination: "B", departAt: input.occurredAt }
        : input.type === "ride_requested"
          ? {
              rideId: input.rideId,
              origin: "A",
              destination: "B",
              seatsWanted: 1,
            }
          : input.type === "ride_matched"
            ? { rideId: input.rideId, driverId: "driver_001", matchLatencyMs: 40_000 }
            : input.type === "ride_accepted"
              ? { rideId: input.rideId, driverId: "driver_001" }
              : {
                  rideId: input.rideId,
                  durationMin: 10,
                  distanceMi: 2,
                  fareCents: 550,
                };

  await sql`
    INSERT INTO events (
      id, type, user_id, session_id, occurred_at, schema_version, properties
    ) VALUES (
      ${randomUUID()},
      ${input.type},
      ${FUNNEL_PREFIX + "user"},
      ${input.sessionId},
      ${input.occurredAt},
      ${1},
      ${sql.json(properties)}
    )
  `;
}

/** Build a session that reaches exactly `steps` funnel stages (in order). */
async function insertSession(sessionKey: string, steps: number): Promise<void> {
  const sessionId = `${FUNNEL_PREFIX}${sessionKey}`;
  const rideId = randomUUID();
  const order: Step[] = [
    "ride_searched",
    "ride_requested",
    "ride_matched",
    "ride_accepted",
    "ride_completed",
  ];

  for (let i = 0; i < steps; i++) {
    const type = order[i];
    if (type === undefined) {
      break;
    }
    const occurredAt = new Date(FROM.getTime() + (i + 1) * 60_000).toISOString();
    await insertEvent({
      sessionId,
      type,
      occurredAt,
      ...(type === "ride_searched" ? {} : { rideId }),
    });
  }
}

describe("queryFunnel", () => {
  before(async () => {
    await sql`DELETE FROM events WHERE session_id LIKE ${FUNNEL_PREFIX + "%"}`;

    // 6 sessions → searched=6, requested=5, matched=4, accepted=3, completed=2
    await insertSession("all_a", 5);
    await insertSession("all_b", 5);
    await insertSession("to_accept", 4);
    await insertSession("to_match", 3);
    await insertSession("to_request", 2);
    await insertSession("search_only", 1);
  });

  after(async () => {
    await sql`DELETE FROM events WHERE session_id LIKE ${FUNNEL_PREFIX + "%"}`;
    await sql.end({ timeout: 5 });
  });

  it("returns exact step counts and conversions", async () => {
    const result = await queryFunnel({ from: FROM, to: TO });

    assert.deepEqual(
      result.steps.map((s) => ({ step: s.step, count: s.count })),
      [
        { step: "ride_searched", count: 6 },
        { step: "ride_requested", count: 5 },
        { step: "ride_matched", count: 4 },
        { step: "ride_accepted", count: 3 },
        { step: "ride_completed", count: 2 },
      ],
    );

    const [searched, requested, matched, accepted, completed] = result.steps;
    assert.ok(searched && requested && matched && accepted && completed);

    assert.equal(searched.conversionFromPrevious, null);
    assert.equal(searched.conversionFromTop, 1);

    assert.equal(requested.conversionFromPrevious, 5 / 6);
    assert.equal(requested.conversionFromTop, 5 / 6);

    assert.equal(matched.conversionFromPrevious, 4 / 5);
    assert.equal(matched.conversionFromTop, 4 / 6);

    assert.equal(accepted.conversionFromPrevious, 3 / 4);
    assert.equal(accepted.conversionFromTop, 3 / 6);

    assert.equal(completed.conversionFromPrevious, 2 / 3);
    assert.equal(completed.conversionFromTop, 2 / 6);
  });
});
