import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // Rate limiting: 10 requests per minute (by IP, no auth required)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  try {
    await checkRateLimit(ip, 'health-check');
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429 }
      );
    }
    console.warn('Rate limit check failed:', error);
  }

  return NextResponse.json({
    status: "ok",
    timestamp: Date.now(),
  });
}
