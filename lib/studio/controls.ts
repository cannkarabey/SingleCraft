import { z } from "zod";
import { TONES } from "@/lib/radar/niches";

// Studio inputs (PDF §3.3, plan §8.2 control panel).
export const STUDIO_PLATFORMS = [
  "x",
  "linkedin",
  "youtube_shorts",
  "reels",
  "newsletter",
  "blog",
] as const;
export const STUDIO_FORMATS = [
  "thread",
  "post",
  "video_hook",
  "video_script",
  "newsletter_section",
  "blog_draft",
] as const;
export const LENGTHS = ["short", "medium", "long"] as const;

export const ControlsInput = z.object({
  platform: z.enum(STUDIO_PLATFORMS),
  format: z.enum(STUDIO_FORMATS),
  tone: z.enum(TONES),
  audience: z.string().trim().max(100).optional().nullable(),
  length: z.enum(LENGTHS).optional().nullable(),
  user_take: z.string().trim().max(1000).optional().nullable(),
});
export type ControlsInput = z.infer<typeof ControlsInput>;

export const GenerateInput = ControlsInput.extend({ storyId: z.uuid() });
