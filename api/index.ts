// Vercel serverless entry — wraps the Fastify app over Node's IncomingMessage/ServerResponse.

import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../packages/server/src/app.js";

// Module-scope promise so warm isolates reuse one ready Fastify instance.
const appPromise = buildApp();

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await appPromise;
  await app.ready();
  // Production URLs are /api/events; local routes are /events. Strip the prefix
  // so one Fastify route table works in both environments.
  if (req.url?.startsWith("/api")) {
    req.url = req.url.slice("/api".length) || "/";
  }
  app.server.emit("request", req, res);
}
