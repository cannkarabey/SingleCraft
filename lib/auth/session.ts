import "server-only";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's id and email from the verified JWT claims, or null. */
export async function currentUser(): Promise<{
  id: string;
  email: string | null;
  /** A guest session (Studio without an account); not a signed-in member. */
  anonymous: boolean;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    anonymous: claims.is_anonymous === true,
  };
}
