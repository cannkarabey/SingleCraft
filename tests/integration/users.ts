import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { db } from "./helpers";

/** A real auth user and a client signed in as them (RLS applies). */
export async function makeUser() {
  const email = `it-${randomUUID().slice(0, 8)}@test.dev`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;

  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  return {
    id,
    email,
    client,
    remove: () => db.auth.admin.deleteUser(id).then(() => undefined),
  };
}
