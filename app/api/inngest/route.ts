import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Inngest runs each step as one request to this route; Vercel's default limit is too short
// for LLM calls and feed fetches (60 s is the most the Hobby plan allows).
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
