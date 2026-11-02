import { NextResponse } from "next/server";
import { publicJson } from "@/lib/discover/http";
import { getStory } from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const { storyId } = await params;
  if (storyId.length > 200)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const story = await getStory(createPublicClient(), storyId);
  if (!story) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return publicJson(story);
}
