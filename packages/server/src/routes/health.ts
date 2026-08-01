// GET /health — liveness probe for local dev and Vercel.

import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true }));
}
