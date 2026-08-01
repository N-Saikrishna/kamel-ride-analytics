// Builds the Fastify app (shared by local `npm run dev` and the Vercel handler).

import Fastify from "fastify";
import { registerEventRoutes } from "./routes/events.js";
import { registerHealthRoutes } from "./routes/health.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await registerHealthRoutes(app);
  await registerEventRoutes(app);

  return app;
}
