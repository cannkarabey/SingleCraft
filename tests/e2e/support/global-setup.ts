import { mkdirSync } from "node:fs";
import { seed } from "./seed";

export default async function globalSetup() {
  mkdirSync("test-results", { recursive: true });
  await seed();
}
