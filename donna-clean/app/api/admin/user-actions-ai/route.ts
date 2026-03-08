import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "alfred@thedonnaapp.co";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Module-level cache — single admin user, no DB column needed
type ActionItem = {
  priority: "urgent" | "watch" | "good" | "none";
  username: string;
  action: string;
  reason: string;
};
type AggregateStats = {
  total_users: number;
  active_this_week: number;
  never_started: number;
  ai_engaged: number;
};
type CacheEntry = {
  actions: ActionItem[];
  stats: AggregateStats;
  generated_at: string;
};

let moduleCache: CacheEntry | null = null;
let cacheExpiry = 0;

const SYSTEM_PROMPT = `You are an operations assistant for Alfred, the sole founder of The Donna app. You monitor user health and tell Alfred exactly what to do today to grow and retain his user base.

You will receive a list of users with their stats: signup date, last login, last entry date, total entries, active days, AI chat count.

Return a JSON object with a single key "actions" containing an array of action items. Each item has:
- priority: 'urgent' | 'watch' | 'good' | 'none'
- username: string
- action: one plain English sentence telling Alfred what to do
- reason: one plain English sentence explaining why

Rules for priority:
- urgent: signed up 2+ days ago AND zero entries ever
- urgent: was active (10+ entries) AND no entries in 5+ days
- watch: signed up in last 48 hours AND has entries already (new momentum, nurture it)
- watch: has entries but zero AI chats ever (not discovering Donna AI)
- good: active in last 2 days with entries
- none: inactive 30+ days with zero entries (deprioritise for now)

Only return JSON. No preamble. No markdown.`;

export async function GET(req: NextRequest) {
  try {
    // Auth gate — must be alfred@thedonnaapp.co with admin role
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);
    if (!user || user.email !== ADMIN_EMAIL || user.app_metadata?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
    const now = Date.now();

    // Return cached result unless force-refresh or expired
    if (!forceRefresh && moduleCache && now < cacheExpiry) {
      return NextResponse.json({ ...moduleCache, cached: true });
    }

    // Fetch user stats via RPC
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("get_enhanced_user_stats");
    if (rpcError) {
      console.error("[user-actions-ai] RPC error:", rpcError);
      return NextResponse.json({ error: "Failed to fetch user stats" }, { status: 500 });
    }

    const users = (rpcData || []) as Record<string, unknown>[];

    // Compute aggregate stats
    const nowDate = new Date();
    const sevenDaysAgo = new Date(nowDate.getTime() - 7 * 86400_000);

    const stats: AggregateStats = {
      total_users: users.length,
      active_this_week: users.filter((u) => {
        const lastEntry = u.last_entry_date ? new Date(u.last_entry_date as string) : null;
        return lastEntry && lastEntry >= sevenDaysAgo;
      }).length,
      never_started: users.filter((u) => Number(u.total_entries) === 0).length,
      ai_engaged: users.filter((u) => Number(u.total_ai_chats) > 0).length,
    };

    // Build compact user list for the AI prompt
    const userLines = users.map((u) => {
      const signedUpDaysAgo = u.created_at
        ? Math.floor((nowDate.getTime() - new Date(u.created_at as string).getTime()) / 86400_000)
        : 999;
      const lastLoginDaysAgo = u.last_sign_in
        ? Math.floor((nowDate.getTime() - new Date(u.last_sign_in as string).getTime()) / 86400_000)
        : 999;
      const lastEntryDaysAgo = u.last_entry_date
        ? Math.floor((nowDate.getTime() - new Date(u.last_entry_date as string).getTime()) / 86400_000)
        : null;

      return [
        `username=${u.username}`,
        `signed_up=${signedUpDaysAgo}d_ago`,
        `last_login=${lastLoginDaysAgo}d_ago`,
        `total_entries=${Number(u.total_entries)}`,
        `last_entry=${lastEntryDaysAgo !== null ? `${lastEntryDaysAgo}d_ago` : "never"}`,
        `active_days_30d=${Number(u.active_days_30d)}`,
        `ai_chats=${Number(u.total_ai_chats)}`,
      ].join(" | ");
    }).join("\n");

    const userContent = `Today: ${nowDate.toISOString().split("T")[0]}\n\nUsers:\n${userLines}`;

    // Call Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            actions: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  priority: { type: SchemaType.STRING, enum: ["urgent", "watch", "good", "none"] },
                  username: { type: SchemaType.STRING },
                  action:   { type: SchemaType.STRING },
                  reason:   { type: SchemaType.STRING },
                },
                required: ["priority", "username", "action", "reason"],
              },
            },
          },
          required: ["actions"],
        },
      },
    });

    let aiActions: ActionItem[] = [];
    try {
      const response = await model.generateContent(userContent);
      const raw = response.response.text().trim();
      const parsed = JSON.parse(raw);
      if (parsed.actions && Array.isArray(parsed.actions)) {
        aiActions = parsed.actions as ActionItem[];
      }
    } catch (aiErr) {
      console.error("[user-actions-ai] Gemini error:", aiErr);
      return NextResponse.json({ error: "AI call failed" }, { status: 502 });
    }

    const entry: CacheEntry = {
      actions: aiActions,
      stats,
      generated_at: new Date().toISOString(),
    };

    // Store in module cache
    moduleCache = entry;
    cacheExpiry = Date.now() + CACHE_TTL_MS;

    return NextResponse.json({ ...entry, cached: false });
  } catch (err) {
    console.error("[user-actions-ai] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
