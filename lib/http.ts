import { NextResponse } from "next/server";

export const unauthorized = () =>
  NextResponse.json({ error: "unauthorized" }, { status: 401 });
export const notFound = () =>
  NextResponse.json({ error: "not_found" }, { status: 404 });
export const invalid = (details: unknown) =>
  NextResponse.json({ error: "invalid_request", details }, { status: 400 });

/** Parsed JSON body or undefined when the body is not valid JSON. */
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
