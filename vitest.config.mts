import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";

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
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
