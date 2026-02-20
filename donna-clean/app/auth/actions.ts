"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeString } from "@/lib/sanitization";

type AuthState = {
  error?: string | null;
  success?: boolean;
};

const getOrigin = async () => {
  // Prefer explicit site URL from env (most reliable on Vercel)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  const headerList = await headers();
  // Try origin header first, then fall back to host-based construction
  const origin = headerList.get("origin");
  if (origin) {
    return origin.replace(/\/+$/, "");
  }
  const host = headerList.get("host");
  if (host) {
    const protocol = host.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}`;
  }
  return "http://localhost:3000";
};

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email and password are required" };
  }

  // Sanitize email to prevent injection attacks
  const sanitizedEmail = sanitizeString(email).trim().toLowerCase();

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password
    });

    if (error) {
      return { error: "Invalid credentials" };
    }

    const user = data.user;
    const confirmedTimestamp =
      user?.email_confirmed_at ??
      (user as { confirmed_at?: string | null })?.confirmed_at ??
      (user?.user_metadata?.confirmed_at as string | null) ??
      null;
    const isVerified = Boolean(confirmedTimestamp);

    if (!isVerified) {
      await supabase.auth.signOut();
      return { error: "Verify email" };
    }

    redirect("/home");
  } catch (error) {
    console.error('Login error:', error);
    return { error: "An error occurred during login. Please try again." };
  }
}

export async function signUpAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const repeatPassword = formData.get("repeat-password");

  if (typeof email !== "string" || typeof password !== "string" || typeof repeatPassword !== "string") {
    return { error: "Please complete the form." };
  }

  if (password !== repeatPassword) {
    return { error: "Passwords do not match" };
  }

  // Validate password strength
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long" };
  }

  // Sanitize email
  const sanitizedEmail = sanitizeString(email).trim().toLowerCase();

  try {
    const supabase = await createSupabaseServerClient();
    const origin = await getOrigin();

    const { error } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password,
      options: {
        emailRedirectTo: `${origin}/protected`,
      },
    });

    if (error) {
      console.error("[signUpAction] Signup error:", error);
      return { error: "Something went wrong. Please try again." };
    }

    redirect("/auth/sign-up-success");
  } catch (error) {
    console.error('Signup error:', error);
    return { error: "An error occurred during signup. Please try again." };
  }
}

export async function forgotPasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email");

  if (typeof email !== "string") {
    return { error: "Email is required" };
  }

  // Sanitize email
  const sanitizedEmail = sanitizeString(email).trim().toLowerCase();

  try {
    const supabase = await createSupabaseServerClient();
    const origin = await getOrigin();
    // Redirect to the client-side reset-password page which handles
    // Supabase recovery hash fragments (#access_token=...&type=recovery).
    // NOTE: This URL must also be whitelisted in Supabase Dashboard under
    // Authentication > URL Configuration > Redirect URLs:
    //   https://www.thedonnaapp.co/reset-password
    //   https://thedonnaapp.co/reset-password
    //   http://localhost:3000/reset-password
    const redirectUrl = `${origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error("[forgotPasswordAction] Supabase error:", error);
      return { error: "Something went wrong. Please try again." };
    }

    return { success: true };
  } catch (error) {
    console.error("[Forgot Password] Unexpected error:", error);
    return { error: "An error occurred. Please try again." };
  }
}

export async function updatePasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get("password");

  if (typeof password !== "string" || !password.length) {
    return { error: "Password is required" };
  }

    const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("[updatePasswordAction] Update error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/auth/login");
}

export async function logoutAction() {
    const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
