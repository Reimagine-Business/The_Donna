"use client";

import { MailCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type VerifyEmailAlertProps = {
  email?: string;
  className?: string;
  showHint?: boolean;
};

export function VerifyEmailAlert({ email, className, showHint = true }: VerifyEmailAlertProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4 text-sm text-emerald-50 shadow-lg shadow-emerald-500/10",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-500/15 p-2 text-emerald-300">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-white">Confirm your email</p>
          <p className="text-emerald-50/80">
            {email
              ? `We just sent a magic confirmation link to ${email}.`
              : "We just sent a confirmation link to your inbox."}
          </p>
          {showHint ? (
            <p className="text-xs text-emerald-50/60">
              Didn&apos;t get it? Check spam or promotions, then click the link to finish signing in.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
