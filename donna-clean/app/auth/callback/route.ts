import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  console.log("[auth/callback] Full URL:", request.url);
  console.log("[auth/callback] Code present:", !!code);
  console.log("[auth/callback] Next param:", next);

  if (code) {
    const cookieStore = await cookies();

    // Debug: log all cookies to check if code_verifier exists
    // PKCE flow stores a code_verifier cookie (sb-*-auth-token-code-verifier)
    // that must be present for exchangeCodeForSession to succeed.
    // If forgotPasswordAction's server client can't write cookies (it only
    // has get(), no set()), the code_verifier is never stored and exchange
    // will always fail.
    const allCookies = cookieStore.getAll();
    console.log(
      "[auth/callback] Available cookies:",
      allCookies.map((c) => c.name)
    );
    const codeVerifierCookie = allCookies.find((c) =>
      c.name.includes("code-verifier")
    );
    console.log(
      "[auth/callback] Code verifier cookie present:",
      !!codeVerifierCookie
    );

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    console.log(
      "[auth/callback] Exchange result - error:",
      error?.message ?? "none",
      "session:",
      !!data?.session
    );

    if (!error) {
      // Successfully exchanged — redirect to the target page with session ready
      return NextResponse.redirect(
        new URL(`${next}?session=ready`, requestUrl.origin)
      );
    }

    console.error("[auth/callback] Code exchange failed:", error.message);
    return NextResponse.redirect(
      new URL(
        `${next}?error=code_exchange_failed&error_description=This+reset+link+has+expired+or+already+been+used`,
        requestUrl.origin
      )
    );
  }

  // No code provided
  console.warn("[auth/callback] No code parameter in URL");
  return NextResponse.redirect(
    new URL(
      "/reset-password?error=no_code&error_description=Invalid+reset+link",
      requestUrl.origin
    )
  );
}
