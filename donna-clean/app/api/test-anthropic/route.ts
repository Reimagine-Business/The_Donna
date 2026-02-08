import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: "error",
      message: "ANTHROPIC_API_KEY not found in environment variables",
    }, { status: 500 });
  }

  const isValidFormat = apiKey.startsWith("sk-ant-");

  return NextResponse.json({
    status: "success",
    message: "API key found and configured",
    keyFormat: isValidFormat ? "valid" : "unknown",
    keyPrefix: apiKey.substring(0, 12) + "...",
    keyLength: apiKey.length,
  });
}
