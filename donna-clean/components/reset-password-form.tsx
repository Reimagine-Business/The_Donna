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

  // Comprehensive recovery session detection.
  //
  // Supabase can redirect here with different URL formats depending on the
  // configured auth flow:
  //   1. ?session=ready          — from our /auth/callback server route (PKCE success)
  //   2. ?code=XXX               — PKCE code (try server-side exchange)
  //   3. ?token_hash=XXX&type=recovery — magic link / token hash flow
  //   4. #access_token=XXX&type=recovery — implicit flow (hash fragment)
  //   5. Existing session         — already authenticated
  //
  // We also listen for onAuthStateChange as a catch-all.
  useEffect(() => {
    let mounted = true;

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    // Check for errors first (from callback route or Supabase redirect)
    const urlError = params.get("error") || hashParams.get("error");
    if (urlError) {
      const errorDescription =
        params.get("error_description") || hashParams.get("error_description");
      const errorCode = params.get("error_code") || hashParams.get("error_code");

      if (errorCode === "user_banned") {
        setError("This account has been suspended. Please contact support.");
      } else {
        setError(
          errorDescription
            ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
            : "Password reset failed. Please try again."
        );
      }
      setLoading(false);
      return;
    }

    const cleanupTimeouts: ReturnType<typeof setTimeout>[] = [];

    // Auth state change listener — catches PASSWORD_RECOVERY and SIGNED_IN
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        markRecovered();
      }
      if (event === "SIGNED_IN" && session) {
        markRecovered();
      }
    });

    async function attemptRecovery() {
      // Method 1: ?session=ready (from our callback route — PKCE already exchanged)
      if (params.get("session") === "ready") {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session) {
          window.history.replaceState({}, "", "/reset-password");
          markRecovered();
          return;
        }
      }

      // Method 2: ?code=XXX (PKCE — try server exchange via callback route)
      const code = params.get("code");
      if (code) {
        try {
          await fetch(
            `/auth/callback?code=${encodeURIComponent(code)}&next=/reset-password`,
            { redirect: "manual" }
          );
          if (!mounted) return;
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            window.history.replaceState({}, "", "/reset-password");
            markRecovered();
            return;
          }
        } catch (e) {
          console.error("[reset-password] Code exchange failed:", e);
        }
      }

      // Method 3: ?token_hash=XXX&type=recovery (token hash / magic link flow)
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (!mounted) return;
        if (!error) {
          window.history.replaceState({}, "", "/reset-password");
          markRecovered();
          return;
        }
        console.error("[reset-password] Token hash verification failed:", error.message);
      }

      // Method 4: #access_token=XXX&type=recovery (implicit flow via hash)
      const accessToken = hashParams.get("access_token");
      const hashType = hashParams.get("type");
      if (accessToken && hashType === "recovery") {
        // Give the Supabase client a moment to process the hash fragment
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (!mounted) return;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          window.history.replaceState({}, "", "/reset-password");
          markRecovered();
          return;
        }
      }

      // Method 5: Check for existing session (user may already be authenticated)
      if (!mounted) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && mounted) {
        markRecovered();
      }
    }

    attemptRecovery();

    // Timeout: 10 seconds before showing "expired"
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
      cleanupTimeouts.forEach((t) => clearTimeout(t));
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

  // Error state — callback failure, URL error params, or submission error
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
