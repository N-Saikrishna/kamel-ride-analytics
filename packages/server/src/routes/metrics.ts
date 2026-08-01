// GET /metrics/* — read-only analytics endpoints with Zod-validated query params.

import type { FastifyInstance } from "fastify";
import {
  MetricsRoutesQuerySchema,
  MetricsTimeseriesQuerySchema,
} from "@kamel/shared";
import { ZodError } from "zod";
import {
  queryFunnel,
  queryHeatmap,
  queryPipelineHealth,
  queryRoutes,
  querySummary,
  queryTimeseries,
} from "../metrics/queries.js";
import { parseMetricsRange } from "../metrics/range.js";

function sendZodError(
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  error: unknown,
): unknown {
  if (error instanceof ZodError) {
    return reply.status(400).send({ errors: error.issues });
  }
  if (error instanceof RangeError) {
    return reply.status(400).send({ errors: [{ message: error.message }] });
  }
  throw error;
}

export async function registerMetricsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/metrics/summary", async (request, reply) => {
    try {
      const range = parseMetricsRange(request.query);
      return await querySummary(range);
    } catch (error) {
      return sendZodError(reply, error);
    }
  });

  app.get("/metrics/funnel", async (request, reply) => {
    try {
      const range = parseMetricsRange(request.query);
      return await queryFunnel(range);
    } catch (error) {
      return sendZodError(reply, error);
    }
  });

  app.get("/metrics/timeseries", async (request, reply) => {
    try {
      const query = MetricsTimeseriesQuerySchema.parse(request.query);
      const range = parseMetricsRange(query);
      return await queryTimeseries(range, query.granularity, query.type);
    } catch (error) {
      return sendZodError(reply, error);
    }
  });

  app.get("/metrics/routes", async (request, reply) => {
    try {
      const query = MetricsRoutesQuerySchema.parse(request.query);
      const range = parseMetricsRange(query);
      return await queryRoutes(range, query.limit);
    } catch (error) {
      return sendZodError(reply, error);
    }
  });

  app.get("/metrics/heatmap", async (request, reply) => {
    try {
      const range = parseMetricsRange(request.query);
      return await queryHeatmap(range);
    } catch (error) {
      return sendZodError(reply, error);
    }
  });

  app.get("/metrics/pipeline-health", async (request, reply) => {
    try {
      const range = parseMetricsRange(request.query);
      return await queryPipelineHealth(range);
    } catch (error) {
      return sendZodError(reply, error);
    }
  });
}
