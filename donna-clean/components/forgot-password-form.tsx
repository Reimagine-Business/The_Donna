"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Mail, Check } from "lucide-react";

import { forgotPasswordAction } from "@/app/auth/actions";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [state, formAction] = useActionState(forgotPasswordAction, {
    error: null,
    success: false,
  });

  if (state?.success) {
    return (
      <div className={className} {...props}>
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-2xl border border-purple-500/30 p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Check Your Email
          </h1>

          <p className="text-white/60 mb-6">
            We&apos;ve sent a password reset link to:
          </p>

          <p className="text-purple-400 font-medium mb-8">{email}</p>

          <p className="text-white/40 text-sm mb-6">
            Click the link in the email to reset your password. The link will
            expire in 1 hour.
          </p>

          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={className} {...props}>
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-2xl border border-purple-500/30 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center">
            <Mail className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Forgot Password</h1>
            <p className="text-white/60 text-sm">
              We&apos;ll send you a reset link
            </p>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-purple-900/20 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              required
              autoFocus
            />
          </div>

          {state?.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {state.error}
            </div>
          )}

          <SubmitButton />

          <div className="text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-purple-800/50 disabled:to-pink-800/50 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3 font-medium transition-colors"
    >
      {pending ? "Sending..." : "Send Reset Link"}
    </button>
  );
}
