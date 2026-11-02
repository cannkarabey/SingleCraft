import "server-only";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The signed-in user when they are an admin (`profiles.is_admin`), else null. Callers
 * answer null with 404 so the admin surface is not discoverable.
 */
export async function requireAdmin() {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return data?.is_admin ? user : null;
}
