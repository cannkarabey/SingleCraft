import { unseed } from "./seed";

export default async function globalTeardown() {
  await unseed();
}
