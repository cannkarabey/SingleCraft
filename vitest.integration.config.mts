import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";

// Runs against the local Supabase stack (`npm run db:start`); reads .env.local.
export default defineConfig({
  plugins: [tsconfigPaths()],
  // `server-only` throws outside a React Server environment; tests run in plain Node.
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("tests/helpers/empty.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
