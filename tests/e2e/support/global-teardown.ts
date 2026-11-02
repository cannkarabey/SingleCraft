import { deleteE2eUsers } from "./radar-seed";
import { unseed } from "./seed";

export default async function globalTeardown() {
  await unseed();
  await deleteE2eUsers();
}
