// Vite config — React plugin, workspace shared alias, /metrics proxy to the API.

import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@kamel/shared": path.resolve(root, "../shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev-only: browser calls same-origin /metrics/*, Vite forwards to Fastify.
      "/metrics": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
