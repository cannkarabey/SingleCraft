import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Public JSON routes are excluded: they use a session-less client and send
// `cache-control: public`, which must never travel with a refreshed session cookie.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/inngest|api/billing/webhook|api/email/webhook|api/discover|api/categories|api/trending|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
