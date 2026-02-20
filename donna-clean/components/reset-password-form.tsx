"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, Check, AlertCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [recoveryDetected, setRecoveryDetected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Track whether we've already detected recovery to avoid redundant state updates
  const recoveredRef = useRef(false);

  function markRecovered() {
    if (recoveredRef.current) return;
    recoveredRef.current = true;
    setRecoveryDetected(true);
    setLoading(false);
  }

  // Detect Supabase recovery session.
  //
  // Supabase supports two auth flows for password recovery:
  //
  // 1. PKCE flow (default): Redirects to /reset-password?code=XXXXX
  //    The code must be exchanged for a session via exchangeCodeForSession().
  //    The code can only be exchanged ONCE — refreshing won't work.
  //
  // 2. Implicit flow (fallback): Redirects with hash fragments
  //    /reset-password#access_token=...&refresh_token=...&type=recovery
  //    The Supabase browser client auto-processes these on init.
  //
  // We handle both flows plus error parameters from Supabase.
  useEffect(() => {
    let mounted = true;
    const cleanupFns: (() => void)[] = [];

    // Auth state change listener — always active for both flows
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        markRecovered();
      }
      // Recovery tokens also trigger SIGNED_IN after the session is established
      if (event === "SIGNED_IN" && session) {
        markRecovered();
      }
    });

    // Main detection logic (async to support PKCE exchange)
    async function detectRecoverySession() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const urlError = urlParams.get("error");
      const errorDescription = urlParams.get("error_description");
      const errorCode = urlParams.get("error_code");

      // Handle error parameters from Supabase (user_banned, access_denied, etc.)
      if (urlError) {
        if (!mounted) return;
        if (errorCode === "user_banned") {
          setError(
            "This account has been suspended. Please contact support."
          );
        } else {
          setError(
            errorDescription || "Password reset failed. Please try again."
          );
        }
        setLoading(false);
        return;
      }

      // PKCE flow: exchange ?code= query parameter for a session
      if (code) {
        try {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!mounted) return;
          if (exchangeError) {
            console.error(
              "[reset-password] Code exchange failed:",
              exchangeError
            );
            setError(
              "This reset link has expired or already been used. Please request a new one."
            );
            setLoading(false);
            return;
          }
          if (data.session) {
            // Clear the code from the URL so refresh doesn't re-attempt exchange
            window.history.replaceState({}, "", "/reset-password");
            markRecovered();
            return;
          }
        } catch (err) {
          if (!mounted) return;
          console.error("[reset-password] Code exchange error:", err);
          setError(
            "Something went wrong. Please request a new reset link."
          );
          setLoading(false);
          return;
        }
      }

      // Implicit flow fallback: detect hash fragments (#access_token=...&type=recovery)
      const hash = window.location.hash;
      if (hash && hash.includes("type=recovery")) {
        // Hash fragment present — Supabase client is processing it.
        // Wait briefly then verify the session was established.
        const hashTimeout = setTimeout(async () => {
          if (!mounted || recoveredRef.current) return;
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session && mounted) {
            markRecovered();
          }
        }, 1500);
        cleanupFns.push(() => clearTimeout(hashTimeout));
      }

      // Immediate session check — catches already-processed sessions
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted || recoveredRef.current) return;
      if (session) {
        markRecovered();
      }
    }

    detectRecoverySession();

    // Timeout: 10 seconds for slow networks before showing "expired"
    const expireTimeout = setTimeout(() => {
      if (!mounted || recoveredRef.current) return;
      setLoading((prev) => {
        if (prev) {
          setExpired(true);
          return false;
        }
        return prev;
      });
    }, 10000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(expireTimeout);
      cleanupFns.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Redirect to login 3 seconds after success
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      router.push("/auth/login");
    }, 3000);
    return () => clearTimeout(timer);
  }, [success, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(
          updateError.message || "Something went wrong. Please try again."
        );
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  }

  // Success state
  if (success) {
    return (
      <div className={className} {...props}>
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-2xl border border-purple-500/30 p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Password Reset</h1>
          <p className="text-green-400 mb-4">
            Your password has been updated successfully.
          </p>
          <p className="text-white/40 text-sm">
            Redirecting to login in a few seconds...
          </p>
          <Link
            href="/auth/login"
            className="inline-block mt-6 text-purple-400 hover:text-purple-300 transition-colors text-sm"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Loading state — waiting for recovery session detection
  if (loading) {
    return (
      <div className={className} {...props}>
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-2xl border border-purple-500/30 p-8 text-center">
          <div className="w-12 h-12 bg-[#8b5cf6]/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Lock className="w-6 h-6 text-purple-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            Verifying Reset Link
          </h1>
          <p className="text-white/40 text-sm">
            Please wait while we verify your password reset link...
          </p>
        </div>
      </div>
    );
  }

  // Error state — PKCE exchange failure, URL error params, or expired link
  if (error && !recoveryDetected && !loading) {
    return (
      <div className={className} {...props}>
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-2xl border border-purple-500/30 p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Password Reset Failed
          </h1>
          <p className="text-red-400/80 text-sm mb-6">{error}</p>
          <Link
            href="/auth/forgot-password"
            className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl px-6 py-3 font-medium transition-colors"
          >
            Request New Link
          </Link>
          <div className="mt-4">
            <Link
              href="/auth/login"
              className="text-white/60 hover:text-white transition-colors text-sm"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Expired / invalid link state (timeout — no session detected)
  if (expired && !recoveryDetected) {
    return (
      <div className={className} {...props}>
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-2xl border border-purple-500/30 p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Invalid or Expired Link
          </h1>
          <p className="text-white/40 text-sm mb-6">
            This password reset link is no longer valid. Please request a new
            one.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl px-6 py-3 font-medium transition-colors"
          >
            Request New Link
          </Link>
          <div className="mt-4">
            <Link
              href="/auth/login"
              className="text-white/60 hover:text-white transition-colors text-sm"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Password reset form
  return (
    <div className={className} {...props}>
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-2xl border border-purple-500/30 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-[#8b5cf6]/20 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="text-white/60 text-sm">Create your new password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-purple-900/20 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 pr-12"
                required
                minLength={8}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-white/40 text-xs mt-1">At least 8 characters</p>
          </div>

          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-purple-900/20 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-purple-800/50 disabled:to-pink-800/50 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3 font-medium transition-colors"
          >
            {submitting ? "Resetting..." : "Reset Password"}
          </button>

          <div className="text-center">
            <Link
              href="/auth/login"
              className="text-white/60 hover:text-white transition-colors text-sm"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
