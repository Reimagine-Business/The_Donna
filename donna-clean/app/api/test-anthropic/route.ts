import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: "error",
      message: "ANTHROPIC_API_KEY not found in environment variables",
    }, { status: 500 });
  }

  return NextResponse.json({
    status: "success",
    message: "API key found and configured",
    keyConfigured: true,
  });
}
