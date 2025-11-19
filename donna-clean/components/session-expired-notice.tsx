"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

type SessionExpiredNoticeProps = {
  message?: string;
  className?: string;
  showLoginButton?: boolean;
};

export function SessionExpiredNotice({
  message = "Your session has expired",
  className,
  showLoginButton = true,
}: SessionExpiredNoticeProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-8 text-center text-white shadow-2xl shadow-black/40",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-amber-300">
        <AlertTriangle className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
        <p className="text-base font-semibold tracking-wide uppercase">Session expired</p>
      </div>
      <div>
        <p className="text-xl font-semibold">{message}</p>
        <p className="mt-2 text-sm text-slate-400">
          Please sign in again to continue accessing your dashboard securely.
        </p>
      </div>
      {showLoginButton ? (
        <Link
          href="/auth/login"
          className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          Go to login
        </Link>
      ) : null}
    </div>
  );
}
