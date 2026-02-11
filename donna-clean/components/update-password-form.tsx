"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Lock, Eye, EyeOff } from "lucide-react";

import { updatePasswordAction } from "@/app/auth/actions";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState("");
  const [state, formAction] = useActionState(updatePasswordAction, {
    error: null,
  });

  function handleSubmit(formData: FormData) {
    setClientError("");

    if (password.length < 8) {
      setClientError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setClientError("Passwords don't match");
      return;
    }

    formAction(formData);
  }

  const displayError = clientError || state?.error;

  return (
    <div className={className} {...props}>
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-2xl border border-purple-500/30 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="text-white/60 text-sm">Create a new password</p>
          </div>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-purple-900/20 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 pr-12"
                required
                minLength={8}
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

          {displayError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {displayError}
            </div>
          )}

          <SubmitButton />

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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-purple-800/50 disabled:to-pink-800/50 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3 font-medium transition-colors"
    >
      {pending ? "Resetting..." : "Reset Password"}
    </button>
  );
}
