// POST /events and POST /events/batch — validate, persist, dead-letter failures.

import type { FastifyInstance } from "fastify";
import { parseEvent, type AnyEvent } from "@kamel/shared";
import { z } from "zod";
import { deadLetter, insertEvent, insertEvents } from "../ingest.js";

const MAX_BATCH = 500;

export async function registerEventRoutes(app: FastifyInstance): Promise<void> {
  app.post("/events", async (request, reply) => {
    const parsed = parseEvent(request.body);
    if (!parsed.success) {
      await deadLetter(request.body, parsed.errors);
      return reply.status(400).send({
        accepted: false,
        errors: parsed.errors,
      });
    }

    const { duplicate } = await insertEvent(parsed.data);
    return reply.status(200).send({ accepted: true, duplicate });
  });

  app.post("/events/batch", async (request, reply) => {
    // Reject non-arrays / oversized batches before iterating — whole-request shape errors.
    const bodyResult = z.array(z.unknown()).max(MAX_BATCH).safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        accepted: 0,
        duplicates: 0,
        rejected: bodyResult.error.issues.map((issue) => ({
          index: -1,
          errors: [issue],
        })),
      });
    }

    const items = bodyResult.data;
    const validEvents: AnyEvent[] = [];
    const rejected: { index: number; errors: z.ZodIssue[] }[] = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const parsed = parseEvent(item);
      if (parsed.success) {
        validEvents.push(parsed.data);
      } else {
        rejected.push({ index, errors: parsed.errors });
        await deadLetter(item, parsed.errors);
      }
    }

    const { duplicates } = await insertEvents(validEvents);

    // 207 Multi-Status: partial success is expected; accepted includes idempotent replays.
    return reply.status(207).send({
      accepted: validEvents.length,
      duplicates,
      rejected,
    });
  });
}
